import { ThirdPartyPointsService } from '@app/3pp';
import { EIGENLAYER, LIVE_CHAIN_IDS, ONE_HOUR, S3_3PP_BUCKET_NAME, ThirdPartyPlatform } from '@app/constants';
import { PrismaService } from '@app/db';
import { ThirdPartyPointsResponseData, ThirdPartyRawPointsData } from '@app/models';
import { S3Service } from '@app/s3';
import { getDateAsKeyString } from '@app/utils';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MichiWallet, Prisma } from '@prisma/client';
import BigNumber from 'bignumber.js';

const BATCH_SIZE = 100;

@Injectable()
export class ThirdPartyPointsProcessingSchedulerService {
    private readonly logger = new Logger(ThirdPartyPointsProcessingSchedulerService.name);
    private isRunning = false;

    constructor(
        private prisma: PrismaService,
        private thirdPartyPointsService: ThirdPartyPointsService,
        private s3Service: S3Service
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async getThirdPartyPoints() {
        if (this.isRunning || process.env.ENV == 'gamma') return;
        this.isRunning = true;
        this.logger.log(`Running ${ThirdPartyPointsProcessingSchedulerService.name}`);
        const dateString = getDateAsKeyString();
        for (const chain of LIVE_CHAIN_IDS) {
            try {
                await this.getThirdPartyPointsForChain(chain, dateString);
            } catch (error) {
                this.logger.error(`Error running ${ThirdPartyPointsProcessingSchedulerService.name} on chain ${chain}: ${error}`);
            }
        }
        this.logger.log(`Finished running ${ThirdPartyPointsProcessingSchedulerService.name}`);
        this.isRunning = false;
    }

    async getThirdPartyPointsForChain(chain: string, dateString: string) {
        let i = 0, s3index = 0, wallets: MichiWallet[], lastIndex: number;
        let results = [];
        while (lastIndex != -1) {
            ({ wallets, lastIndex } = await this.prisma.getWalletsByIndex(chain, i, BATCH_SIZE));
            if (lastIndex == -1) break;

            const walletAddresses = wallets.map(wallet => wallet.wallet_address);
            const thirdPartyPoints = await this.prisma.getThirdPartyPointsBulk(walletAddresses);
            const walletsWithPoints = wallets.map(wallet => ({
                ...wallet,
                points: thirdPartyPoints.filter(point => point.address === wallet.wallet_address),
            }));

            const newPointsDbData: Prisma.ThirdPartyPointsUncheckedCreateInput[] = [];

            this.logger.log(`Fetching third party points for wallets from ${i} - ${lastIndex} on chain ${chain}`);
            for (const wallet of walletsWithPoints) {
                const freshPointValues = await this.thirdPartyPointsService.fetchThirdPartyPointTotalsWithRetries(
                    wallet.wallet_address, Object.values(ThirdPartyPlatform));
                newPointsDbData.push(...this.buildPointsDbData(wallet, freshPointValues));
                results.push(this.buildHistoricalDataPoint(wallet, freshPointValues));
            }

            try {
                await this.prisma.setThirdPartyPointsBulk(newPointsDbData);
            } catch (error) {
                this.logger.error(`Error saving 3pp to db: ${error}`);
            }

            if (results.length > 1000) {
                await this.s3Service.uploadFile(
                    S3_3PP_BUCKET_NAME,
                    `${process.env.ENV}/${dateString}/${chain}/${s3index}`, 
                    JSON.stringify(results), 
                    'application/json'
                );
                results = [];
                s3index += 1;
            }

            i += BATCH_SIZE;
        }

        if (results.length > 0) {
            await this.s3Service.uploadFile(
                S3_3PP_BUCKET_NAME,
                `${process.env.ENV}/${dateString}/${chain}/${s3index}`, 
                JSON.stringify(results), 
                'application/json'
            );
        }
    }

    buildPointsDbData(walletWithPoints, freshPointsValues: ThirdPartyRawPointsData[]): Prisma.ThirdPartyPointsUncheckedCreateInput[] {
        const data: Prisma.ThirdPartyPointsUncheckedCreateInput[] = [];
        for (const values of freshPointsValues) {
            const cachedPointsData = walletWithPoints.points.find(point => point.platform == values.platform);
            const cachedPoints = cachedPointsData?.points || '0';
            const cachedElPoints = cachedPointsData?.el_points || '0';
            data.push({
                address: walletWithPoints.wallet_address,
                platform: values.platform,
                points: values.points || cachedPoints,
                el_points: values.elPoints || cachedElPoints,
                stale_at: (values.points || !cachedPointsData) ? new Date(new Date().getTime() + ONE_HOUR) : cachedPointsData.stale_at
            });
        }
        return data;
    }

    buildHistoricalDataPoint(walletWithPoints, freshPointsValues: ThirdPartyRawPointsData[]) {
        const pointValues: ThirdPartyPointsResponseData[] = [];
        let totalElPoints = new BigNumber(0);
        for (const values of freshPointsValues) {
            const cachedPointsData = walletWithPoints.points.find(point => point.platform == values.platform);
            const cachedPoints = cachedPointsData?.points.toString() || '0';
            const cachedElPoints = cachedPointsData?.el_points.toString() || '0';
            totalElPoints = totalElPoints.plus(new BigNumber(values.elPoints || cachedElPoints));
            pointValues.push({
                platform: values.platform,
                points:  values.points || cachedPoints
            });
        }
        pointValues.push({
            platform: EIGENLAYER,
            points: totalElPoints.toString()
        });
        return {
            address: walletWithPoints.wallet_address,
            date: Date.now(),
            points: pointValues
        };
    }
}