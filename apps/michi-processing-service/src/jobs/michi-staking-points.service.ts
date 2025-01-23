import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/db';

@Injectable()
export class MichiStakingPointsService {
    private readonly logger = new Logger(MichiStakingPointsService.name);
    private isRunning = false;

    constructor(
        private prisma: PrismaService,
    ) {
    }

    @Cron(CronExpression.EVERY_HOUR)
    async processMichiPoints() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.logger.log(`Running Michi Staking Points Sync`);
        await this.processStakingPoints();
        this.isRunning = false;
        this.logger.log(`Finished Michi Staking Points Sync`);
    }

    async processStakingPoints() {
        try {
            const stakingInfos = await this.prisma.stakingInfo.findMany();

            for (const stakingInfo of stakingInfos) {
                const currentTimestamp = new Date();
                const hoursElapsed = Math.round(
                    (currentTimestamp.getTime() - new Date(stakingInfo.lastUpdatedAt).getTime()) / (1000 * 60 * 60),
                );

                const stakedAmountInWholeTokens = new Prisma.Decimal(stakingInfo.stakedAmount.toString()).div(new Prisma.Decimal(10).pow(18));
                const earnedPoints = stakedAmountInWholeTokens.mul(5).mul(new Prisma.Decimal(hoursElapsed));

                await this.updateMichiPoints(stakingInfo.walletAddress, earnedPoints, stakingInfo.chain_id);

                await this.prisma.stakingInfo.update({
                    where: {
                        chain_id_walletAddress: {
                            walletAddress: stakingInfo.walletAddress,
                            chain_id: stakingInfo.chain_id,
                        },
                    },
                    data: {
                        lastUpdatedAt: currentTimestamp,
                    },
                });
            }
        } catch (error) {
            this.logger.error(`Error in Michi Staking Points Processing: ${error.message}`);
        }
    }

    async updateMichiPoints(walletAddress: string, earnedPoints: Prisma.Decimal, chain: string) {
        const user = await this.prisma.user.findUnique({
            where: {
                chain_id_address: {
                    chain_id: chain,
                    address: walletAddress,
                },
            },
        });

        if (user) {
            const newMichiPoints = user.michi_points.add(earnedPoints);

            await this.prisma.user.update({
                where: {
                    chain_id_address: {
                        chain_id: chain,
                        address: walletAddress,
                    },
                },
                data: {
                    michi_points: newMichiPoints,
                },
            });

            this.logger.log(`Updated Michi points for ${walletAddress} on chain ${chain} to ${newMichiPoints}`);
        } else {
            this.logger.error(`User with wallet address ${walletAddress} on chain ${chain} not found.`);
        }
    }
}
