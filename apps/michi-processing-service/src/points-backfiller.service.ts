import { DEFAULT_BATCH_SIZE, INITIAL_WALLET_POINTS, MICHI_LAUNCH_DATES, ONE_HOUR, TOKEN_EXCLUSION_LIST } from '@app/constants';
import { PrismaService } from '@app/db';
import { MoralisService } from '@app/moralis';
import { Injectable, Logger } from '@nestjs/common';
import { MichiWallet, Prisma, Token, WalletToken } from '@prisma/client';
import Decimal from 'decimal.js';
import { calculateTotalPointsForTokens, roundToNearestHour } from './calculation-utils';

@Injectable()
export class PointsBackfillerService {
    private readonly logger = new Logger(PointsBackfillerService.name);
    
    constructor(
        private prisma: PrismaService,
        private moralis: MoralisService
    ) {}

    async backfillPointsDataIfNeeded(chainId: string, approvedTokens: Token[]) {
        const lastProcessingTime: Date = await this.prisma.getLastPointsProcessingTime(chainId);
        if (!this.isBackfillNeeded(lastProcessingTime)) {
            return;
        }
        await this.doBackfill(chainId, approvedTokens, lastProcessingTime || MICHI_LAUNCH_DATES[chainId]);
    }

    private isBackfillNeeded(lastProcessingTime: Date) {
        if (!lastProcessingTime) {
            return true;
        } else {
            const currentTime = new Date();
            const difference = currentTime.getTime() - lastProcessingTime.getTime();
            const hoursAgo = Math.round(difference / 1000 / 60 / 60); // convert milliseconds to hours
            return hoursAgo > 1;
        }
    }

    // TODO: handle michi wallet transfers during backfill period
    private async doBackfill(chainId: string, approvedTokens: Token[], lastProcessingTime: Date) {
        this.logger.log(`Backfilling points on chain ${chainId} from last processing time of ${lastProcessingTime}`);
        const roundedLastProcessingTime = roundToNearestHour(lastProcessingTime);

        const ownerMap = new Map<string, Decimal>();
        let i = 0, wallets: MichiWallet[], lastIndex: number;
        while (lastIndex != -1) {
            ({ wallets, lastIndex } = await this.prisma.getWalletsByIndex(chainId, i));
            if (lastIndex == -1) break;

            this.logger.log(`Backfilling points for wallets from ${i} - ${lastIndex} on chain ${chainId}`);

            const walletAddresses = wallets.map(wallet => wallet.wallet_address.toLowerCase());
            const walletTokenBalances = await this.prisma.getWalletTokenBalancesBatchedWithExclusionList(chainId, walletAddresses, TOKEN_EXCLUSION_LIST[chainId]);

            for (let j = 0; j < wallets.length; j++) {
                const ownerAddress = wallets[j].owner_address.toLowerCase();
                const existingPoints = ownerMap.get(ownerAddress) || new Decimal(INITIAL_WALLET_POINTS);
                const tokenBalances = walletTokenBalances.filter(tokenBalance => tokenBalance.wallet_address == wallets[j].wallet_address);

                // TODO: parallelize - sequential moralis calls here are slow. Keep in mind moralis rate limits though
                const pointsToAdd = await this.getWalletPointsToBackfill(chainId, wallets[j], tokenBalances, approvedTokens, roundedLastProcessingTime);

                ownerMap.set(ownerAddress, existingPoints.plus(pointsToAdd));
            }

            i += DEFAULT_BATCH_SIZE;
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

    /** 
     * - fetch tx history
     * - Keep a time variable t that we decrement by 1 hour at a time from now until lastProcessingTime 
     * - At each hour until lastProcessingTime:
     *   - Check if any erc20 transfers in or out in the range of t to t + 1 hour
     *   - if there is a transfer out, increment total for that token by amount
     *   - if there is a transfer in, decrement total for that token by amount
     *   - add points at the hour based on total (include custom points logic for early weeks)
    */
    private async getWalletPointsToBackfill(
        chainId: string,
        wallet: MichiWallet,
        tokenBalances: WalletToken[],
        approvedTokens: Token[],
        lastProcessingTime: Date
    ) {
        let pointsToAdd = new Decimal(0);

        const approvedTokensAddresses = approvedTokens.map(token => token.address);
        const t = roundToNearestHour(new Date());
        t.setHours(t.getHours() - 1);
        let transferHistoryResponse = await this.moralis.getWalletERC20Transfers(chainId, wallet.wallet_address, lastProcessingTime, t);
        let transferHistory = transferHistoryResponse.result;

        let index = 0;
        while (t > lastProcessingTime) {
            t.setHours(t.getHours() - 1);

            if (transferHistory.length > index) {
                let transfer = transferHistory[index];
                let txDate = new Date(transfer.block_timestamp);
                while (txDate > t) {
                    if (txDate <= new Date(t.getTime() + ONE_HOUR)) {
                        const tokenAddress = transfer.address;
                        if (approvedTokensAddresses.includes(tokenAddress) && wallet.wallet_address == transfer.to_address) {
                            this.subtractFromTokenBalance(tokenBalances, tokenAddress, transfer.value);
                        } else if (approvedTokensAddresses.includes(tokenAddress) && wallet.wallet_address == transfer.from_address) {
                            this.addToTokenBalance(tokenBalances, tokenAddress, transfer.value);
                        }
                    }
                    index += 1;
                    if (index >= transferHistory.length) {
                        if (transferHistoryResponse.cursor == null) {
                            break;
                        } else {
                            transferHistoryResponse = await this.moralis.getWalletERC20Transfers(chainId, wallet.wallet_address, lastProcessingTime, t, transferHistoryResponse.cursor);
                            transferHistory = transferHistoryResponse.result;
                            index = 0;
                        }
                    }
                    transfer = transferHistory[index];
                    txDate = new Date(transfer.block_timestamp);
                }
            }
            pointsToAdd = pointsToAdd.plus(calculateTotalPointsForTokens(chainId, tokenBalances, approvedTokens, t));
        }
        return pointsToAdd;
    }

    private subtractFromTokenBalance(tokenBalances: WalletToken[], address: string, value: string) {
        const token = tokenBalances.find(token => token.token_address === address);
        token.balance = token.balance.minus(new Decimal(value));
    }

    private addToTokenBalance(tokenBalances: WalletToken[], address: string, value: string) {
        const token = tokenBalances.find(token => token.token_address === address);
        token.balance = token.balance.plus(new Decimal(value));
    }
}

