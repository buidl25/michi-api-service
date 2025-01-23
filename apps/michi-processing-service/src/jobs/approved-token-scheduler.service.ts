import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { ETH_MAINNET_CHAIN_ID, LIVE_CHAIN_IDS, RENZO_CLAIM_TOKEN_ADDRESS } from '@app/constants';
import { PrismaService } from '@app/db';
import { MoralisService } from '@app/moralis';
import { filterProperties } from '@app/utils';

@Injectable()
export class ApprovedTokenSchedulerService {
    private readonly logger = new Logger(ApprovedTokenSchedulerService.name);
    private isRunning = false;
    
    constructor(
        private prisma: PrismaService,
        private moralis: MoralisService
    ) {}

    // TODO: remove tokens from db that have been removed from approved list
    @Cron(CronExpression.EVERY_HOUR)
    async updateApproveTokens() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.logger.log(`Running ${ApprovedTokenSchedulerService.name}`);
        const tokenKeys = Object.keys(Prisma.TokenScalarFieldEnum) as Array<keyof Prisma.TokenCreateInput>;

        for (const chainId of LIVE_CHAIN_IDS) {
            try {
                const approvedTokenList = await this.moralis.getApprovedTokens(chainId);
                const ancillaryTokenList = chainId == ETH_MAINNET_CHAIN_ID ? [RENZO_CLAIM_TOKEN_ADDRESS] : [];
                for (const tokenAddress of approvedTokenList) {
                    try {
                        const syTokenAddress = await this.moralis.getSyToken(chainId, tokenAddress);
                        ancillaryTokenList.push(syTokenAddress.toLowerCase());
                    } catch (error) {
                        this.logger.log(`Failed to get SY token from token contract: ${tokenAddress} on chain: ${chainId}`);
                    }
                }

                const approvedTokenMetadata: any[] = await this.moralis.getTokenMetadata(chainId, approvedTokenList);
                const dataForInsertion = approvedTokenMetadata.map(tokenMetadata => ({
                    ...filterProperties(tokenMetadata, tokenKeys),
                    decimals: parseInt(tokenMetadata.decimals),
                    block_number: parseInt(tokenMetadata.block_number),
                    chain_id: chainId
                }));
                await this.prisma.setApprovedTokens(dataForInsertion);

                const ancillaryTokenMetadata: any[] = await this.moralis.getTokenMetadata(chainId, ancillaryTokenList);
                const ancillaryDataForInsertion = ancillaryTokenMetadata.map(tokenMetadata => ({
                    ...filterProperties(tokenMetadata, tokenKeys),
                    decimals: parseInt(tokenMetadata.decimals),
                    block_number: parseInt(tokenMetadata.block_number),
                    chain_id: chainId
                }));
                await this.prisma.setAncillaryTokens(ancillaryDataForInsertion);

            } catch (error) {
                this.logger.error(`Failed to get approved tokens: ${error}`);
            }
        }
        this.isRunning = false;
    }
}