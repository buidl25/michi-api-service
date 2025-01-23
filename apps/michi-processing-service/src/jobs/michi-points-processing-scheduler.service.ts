import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MichiWallet, Prisma, Token } from '@prisma/client';
import Decimal from 'decimal.js';
import { LIVE_CHAIN_IDS, DEFAULT_BATCH_SIZE, INITIAL_WALLET_POINTS, TOKEN_EXCLUSION_LIST, SEPOLIA_CHAIN_ID } from '@app/constants';
import { CommonService } from '@app/common';
import { PrismaService } from '@app/db';
import { MoralisService } from '@app/moralis';
import { PointsBackfillerService } from '../points-backfiller.service';
import { calculateTotalPointsForTokens, roundToNearestHour } from '../calculation-utils';

@Injectable()
export class MichiPointsProcessingSchedulerService {
    private readonly logger = new Logger(MichiPointsProcessingSchedulerService.name);
    private isRunning = false;
    
    constructor(
        private prisma: PrismaService,
        private moralis: MoralisService,
        private common: CommonService,
        private backfiller: PointsBackfillerService
    ) {}

    @Cron(CronExpression.EVERY_HOUR)
    async processMichiPoints() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.logger.log(`Running ${MichiPointsProcessingSchedulerService.name}`);
        await Promise.all(LIVE_CHAIN_IDS.map(chainId => this.processChainMichiPoints(chainId)));
        this.logger.log(`Finished running ${MichiPointsProcessingSchedulerService.name}`);
        this.isRunning = false;
    }

    async processChainMichiPoints(chainId: string) {
        if (process.env.ENV == 'gamma' && chainId !== SEPOLIA_CHAIN_ID) return;
        try {
            const numMichiWallets = await this.moralis.getMichiCurrentIndex(chainId);
            const currentNFTIndex = await this.prisma.getCurrentNftIndex(chainId);
            if (currentNFTIndex < numMichiWallets - 1) {
                await this.common.backfillMissingWalletCreates(chainId, currentNFTIndex + 1, numMichiWallets);
            }
            const approvedTokens = await this.prisma.getApprovedTokens(chainId);
            const approvedTokensFiltered = approvedTokens.filter(token => !TOKEN_EXCLUSION_LIST[chainId].includes(token.address));
    
            let i = 0, wallets: MichiWallet[], lastIndex: number;
            while (lastIndex != -1) {
                ({ wallets, lastIndex } = await this.prisma.getWalletsByIndex(chainId, i));
                if (lastIndex == -1) break;
    
                this.logger.log(`Processing points for wallets from ${i} - ${lastIndex} on chain ${chainId}`);
    
                await this.syncWalletOwners(chainId, wallets, i, lastIndex + 1);
                await this.syncTokenBalances(chainId, wallets, approvedTokensFiltered);
                if (process.env.ENV != 'gamma') {
                    await this.updatePointTotals(chainId, wallets, approvedTokensFiltered);
                }
    
                i += DEFAULT_BATCH_SIZE;
            }
            await this.prisma.setLastPointsProcessingTime(chainId, new Date());
        } catch (error) {
            this.logger.error(`Error during ${MichiPointsProcessingSchedulerService.name} on ${chainId}: ${error.message}`);
        }
    }

    async syncWalletOwners(chainId: string, wallets: MichiWallet[], startIndex: number, endIndex: number) {
        this.logger.log(`Syncing wallet owners on chain ${chainId}`);
        const walletOwners = await this.moralis.getMichiNFTOwnerBatched(chainId, startIndex, endIndex);
        const updatedWallets = wallets.map((wallet, index) => ({
            ...wallet,
            owner_address: walletOwners[index],
            stale_at: new Date()
        }));
        await this.prisma.setMichiWallets(updatedWallets);  
    }

    async syncTokenBalances(chainId: string, wallets: MichiWallet[], approvedTokens: Token[]) {
        this.logger.log(`Syncing token balances on chain ${chainId}`);
        const walletAddresses = wallets.map(wallet => wallet.wallet_address);
        for (const token of approvedTokens) {
            const balances = await this.moralis.getERC20TokenBalancesBatched(chainId, token.address, walletAddresses);
            const newTokenBalances: Prisma.WalletTokenUncheckedCreateInput[] = walletAddresses.map((wallet, index) => ({
                chain_id: chainId,
                wallet_address: wallet,
                token_address: token.address,
                balance: balances[index],
                eligible_balance: balances[index],
                stale_at: new Date(),
                has_accrued_interest: balances[index] > 0
            }));
            await this.prisma.setWalletTokenBalances(newTokenBalances);
        }
    }

    async updatePointTotals(chainId: string, wallets: MichiWallet[], approvedTokens: Token[]) {
        this.logger.log(`Updating point totals on chain ${chainId}`);
        const walletAddresses = wallets.map(wallet => wallet.wallet_address.toLowerCase());
        const walletTokenBalances = await this.prisma.getWalletTokenBalancesBatchedWithExclusionList(chainId, walletAddresses, TOKEN_EXCLUSION_LIST[chainId]);

        await this.backfiller.backfillPointsDataIfNeeded(chainId, approvedTokens);
        
        const ownerMap = new Map<string, Decimal>();
        for (const wallet of wallets) {
            const ownerAddress = wallet.owner_address.toLowerCase();
            const existingPoints = ownerMap.get(ownerAddress) || new Decimal(INITIAL_WALLET_POINTS);

            let pointsToAdd = new Decimal(0); 

            const walletTokens = walletTokenBalances.filter(walletToken => walletToken.wallet_address == wallet.wallet_address);
            pointsToAdd = pointsToAdd.plus(
                calculateTotalPointsForTokens(chainId, walletTokens, approvedTokens, roundToNearestHour(new Date()))
            );

            ownerMap.set(ownerAddress, existingPoints.plus(pointsToAdd));
        }

        const usersWithUpdatedPoints: Prisma.UserUncheckedCreateInput[] = [];
        for (const [ownerAddress, points] of ownerMap.entries()) {
            usersWithUpdatedPoints.push({
                chain_id: chainId,
                address: ownerAddress,
                michi_points: points.toString()
            });
        }
        await this.prisma.setUserPoints(usersWithUpdatedPoints);
    }
}