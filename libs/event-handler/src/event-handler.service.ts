import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FIFTEEN_SECONDS } from '@app/constants';
import { PrismaService } from '@app/db';
import { MoralisService } from '@app/moralis';
import BigNumber from 'bignumber.js';
import { CommonService } from '@app/common';

@Injectable()
export class EventHandlerService {
    private readonly logger = new Logger(EventHandlerService.name);

    constructor(
        private readonly moralis: MoralisService,
        private readonly prisma: PrismaService,
        private readonly common: CommonService,
    ) {
    }

    async handleWalletCreatedEvent(args: any[], chain: string) {
        const [sender, walletAddress, nftContract, tokenId] = args;
        this.logger.log(`Received wallet created event. Owner: ${sender}, wallet: ${walletAddress}, index: ${tokenId}`);

        const currentNFTIndex = await this.prisma.getCurrentNftIndex(chain);
        if (tokenId > currentNFTIndex + 1) {
            this.logger.log(`Index ${tokenId} is more than 1 above currentNFTIndex ${currentNFTIndex}. Backfilling missing data.`);
            await this.common.backfillMissingWalletCreates(chain, currentNFTIndex + 1, tokenId);
        }

        const newWallet: Prisma.MichiWalletUncheckedCreateInput = {
            chain_id: chain,
            nft_index: tokenId,
            wallet_address: walletAddress,
            owner_address: sender,
            stale_at: new Date(new Date().getTime() + FIFTEEN_SECONDS),
        };
        await this.prisma.setMichiWallets([newWallet]);

        this.logger.log(`Saved new wallet - nft_index: ${newWallet.nft_index}, wallet_address: ${newWallet.wallet_address}, owner: ${newWallet.owner_address}`);
    }

    async handleDepositEvent(args: any[], chain: string) {
        const [sender, walletAddress, token, amountAfterFees, feeTaken] = args;
        this.logger.log(`Received deposit event. Owner: ${sender}, wallet: ${walletAddress}, token: ${token}, amount: ${amountAfterFees}`);
        const currentToken = await this.prisma.getWalletTokenBalance(chain, walletAddress, token);

        let currentBalance = new BigNumber(0), currentEligibleBalance = new BigNumber(0);
        if (currentToken) {
            currentBalance = new BigNumber(currentToken.balance.toString());
            currentEligibleBalance = new BigNumber(currentToken.eligible_balance.toString());
        }

        const newTokenBalance: Prisma.WalletTokenUncheckedCreateInput = {
            chain_id: chain,
            wallet_address: walletAddress,
            token_address: token,
            balance: currentBalance.plus(amountAfterFees.toString()).toString(),
            eligible_balance: currentEligibleBalance.plus(amountAfterFees.toString()).toString(),
            stale_at: new Date(new Date().getTime() + FIFTEEN_SECONDS),
        };
        await this.prisma.setWalletTokenBalances([newTokenBalance]);

        this.logger.log(`Updated token balance from ${currentBalance} to ${newTokenBalance.balance} - chainId: ${chain}, wallet_address: ${walletAddress}, token_address: ${token}`);
    }

    async updateStakingInfo(walletAddress: string, amount: bigint, chain: string) {
        await this.prisma.stakingInfo.upsert({
            where: {
                chain_id_walletAddress: {
                    chain_id: chain,
                    walletAddress: walletAddress,
                },
            },
            update: {
                stakedAmount: {
                    increment: amount,
                },
            },
            create: {
                walletAddress,
                chain_id: chain,
                stakedAmount: amount,
                lastUpdatedAt: new Date(),
            },
        });

        this.logger.log(`Upserted staking info for ${walletAddress} on chain ${chain} with amount ${amount}`);
    }
}