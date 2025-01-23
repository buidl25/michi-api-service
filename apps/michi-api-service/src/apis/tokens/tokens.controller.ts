import { BadRequestException, Controller, Get, Logger, Param } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { WalletTokenResponseData } from '@app/models';
import { Token } from '@prisma/client';
import { LIVE_CHAIN_IDS } from '@app/constants';
import { TotalTokenResponseData } from '@app/models/tokens';

@Controller({ version: ['1'], path: 'tokens' })
export class TokensController {
    private readonly logger = new Logger(TokensController.name);

    constructor(private readonly tokensService: TokensService) {}

    @Get('total')
    async getTotalTokens(): Promise<TotalTokenResponseData[]> {
        return await this.tokensService.getTotalTokens();
    }

    @Get('totalcoins')
    async getTotalSupply(): Promise<number> {
        return 1000000000;
    }

    @Get('price/:symbol')
    async getTokenPrice(@Param('symbol') symbol: string): Promise<number> {
        return await this.tokensService.getTokenPrice(symbol);
    }

    @Get('rewards-per-year/:chain/:pid')
    async getRewardsPerYear(@Param('chain') chain: string,@Param('pid')pid:number): Promise<{ rewardsPerYear:string }> {
        if (!LIVE_CHAIN_IDS.includes(chain)) {
            throw new BadRequestException(`Invalid chain: ${chain}`);
        }
        const rewardsPerYear = await this.tokensService.getRewardsPerYear(chain,pid);
        return { rewardsPerYear };
    }

    @Get('liquidity/:chain')
    async getTotalLiquidity(@Param('chain') chain: string): Promise<{ totalDepositedLP: string, totalDepositedLiquidityUSD: string }> {
        if (!LIVE_CHAIN_IDS.includes(chain)) {
            throw new BadRequestException(`Invalid chain: ${chain}`);
        }
        return await this.tokensService.getTotalLiquidityForAllPairs(chain);
    }

    @Get('apy/:chain/:pid')
    async getPoolAPY(@Param('chain') chain: string, @Param('pid') pid: number): Promise<{ apy: string }> {
        if (!LIVE_CHAIN_IDS.includes(chain)) {
            throw new BadRequestException(`Invalid chain: ${chain}`);
        }
        const apy = await this.tokensService.getPoolAPY(chain, pid);
        return { apy };
    }

    @Get('share/:chain/:pid/:user')
    async getUserShare(
        @Param('chain') chain: string,
        @Param('pid') pid: number,
        @Param('user') user: string
    ): Promise<{ userSharePercentage: string }> {
        if (!LIVE_CHAIN_IDS.includes(chain)) {
            throw new BadRequestException(`Invalid chain: ${chain}`);
        }
        const userShare = await this.tokensService.getUserShare(chain, pid, user);
        return { userSharePercentage: userShare };
    }

    @Get(':chain/:address')
    async getTokensByChainAndAddress(@Param('chain') chain: string, @Param('address') address: string): Promise<WalletTokenResponseData[]> {
        if (!LIVE_CHAIN_IDS.includes(chain)) {
            throw new BadRequestException(`Invalid chain: ${chain}`);
        }
        return await this.tokensService.getWalletTokens(chain, address);
    }

    @Get(':chain')
    async getAllTokenMetadataByChain(@Param('chain') chain: string): Promise<Token[]> {
        if (!LIVE_CHAIN_IDS.includes(chain)) {
            throw new BadRequestException(`Invalid chain: ${chain}`);
        }
        return await this.tokensService.getAllTokenMetadata(chain);
    }


    @Get(':chain/:address/transactions')
    async getTokenTransactions(@Param('chain') chain: string, @Param('address') address: string): Promise<WalletTokenResponseData[]> {
        if (!LIVE_CHAIN_IDS.includes(chain)) {
            throw new BadRequestException(`Invalid chain: ${chain}`);
        }
        return await this.tokensService.getTokenTransactions(chain, address);
    }


}