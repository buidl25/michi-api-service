import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/db';
import { MoralisService } from '@app/moralis';
import { TokenboundService } from '@app/tokenbound';
import { AncillaryToken, Prisma, Token, WalletToken } from '@prisma/client';
import { MoralisWalletToken, WalletTokenResponseData } from '@app/models';
import {
    CHAIN_NAMES,
    EXTRA_WITHDRAWABLE_TOKENS,
    FIFTEEN_SECONDS, MASTER_CHEF_ADDRESSES,
    MICHI_START_DATES, MICHI_WALLET_NFTS_ADDRESSES,
    MOCK_MOE_PAIR_ADDRESSES,
    SCANNER_BASE_TX_URLS, TOKEN_PAIRS,
} from '@app/constants';
import BigNumber from 'bignumber.js';
import { TotalTokenResponseData } from '@app/models/tokens';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { lastValueFrom } from 'rxjs';
import { EvmReaderService } from '@app/evm-reader';
import { ethers } from 'ethers';
import * as MASTER_CHEF_ABI from '@app/config/abi/masterchef-abi.json';
import * as MOCK_MOE_PAIR_ABI from '@app/config/abi/mock-moe-pair-abi.json';

@Injectable()
export class TokensService {
    private readonly logger = new Logger(TokensService.name);
    private readonly cmcApiUrl = 'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest';
    private readonly cmcApiKey = process.env.CMC_API_KEY;

    constructor(
        private readonly prisma: PrismaService,
        private readonly moralis: MoralisService,
        private readonly tokenbound: TokenboundService,
        private readonly httpService: HttpService,
        private readonly evmReader: EvmReaderService,
    ) {
    }

    async getTokenPrice(symbol: string): Promise<number> {
        const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbol}&convert=USD`;
        const response: AxiosResponse<any> = await lastValueFrom(
            this.httpService.get(url, {
                headers: {
                    'X-CMC_PRO_API_KEY': this.cmcApiKey,
                },
            }),
        );
        const data = response.data.data;

        if (data[symbol.toUpperCase()]) {
            return data[symbol.toUpperCase()].quote.USD.price;
        } else {
            throw new NotFoundException(`Token price for symbol ${symbol} not found`);
        }
    }

    async getRewardsPerYear(chain: string,pid:number): Promise<string> {
        try {
            const contractAddress = MASTER_CHEF_ADDRESSES[chain];
            console.log('contractAddress', contractAddress);
            const provider = this.evmReader.providers.get(chain);
            const masterChefContract = new ethers.Contract(contractAddress, MASTER_CHEF_ABI, provider);
            const rewardPerBlock = await masterChefContract.rewardPerBlock();
            console.log('rewardPerBlock', rewardPerBlock);

            const totalPoolWeight = await masterChefContract.totalPoolWeight();
            console.log('totalPoolWeight', totalPoolWeight.toString());

            const poolInfo = await masterChefContract.poolInfo(pid);
            const poolWeight = poolInfo.poolWeight;
            console.log('poolWeight', poolWeight.toString());

            const poolRewardPerBlock = (rewardPerBlock * poolWeight)/totalPoolWeight;
            console.log('poolRewardPerBlock', poolRewardPerBlock.toString());

            // This calculation is specific to Mantle
            const blocksPerYear = (60 * 60 * 24 * 365) / 2; // ~15,768,000 blocks per year
            const rewardsPerYear = BigInt(poolRewardPerBlock) * BigInt(blocksPerYear);

            return rewardsPerYear.toString();
        } catch (error) {
            this.logger.error('Error fetching rewards per year:', error.message);
            throw new HttpException('Failed to calculate rewards per year', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getTotalLiquidityForAllPairs(chain: string): Promise<{ totalDepositedLP: string, totalDepositedLiquidityUSD: string }> {
        try {
            const pairs = TOKEN_PAIRS[chain];
            let totalDepositedLP = BigInt(0);
            let totalDepositedLiquidity = BigInt(0);

            for (const pair of pairs) {
                const [token0Symbol, token1Symbol] = pair.split('/');

                const { totalDepositedLP: pairDepositedLP, totalDepositedLiquidityUSD: pairDepositedLiquidityUSD } = await this.getTotalLiquidity(chain, token0Symbol, token1Symbol);
                totalDepositedLP += BigInt(pairDepositedLP);
                totalDepositedLiquidity += BigInt(Number(pairDepositedLiquidityUSD) * 1e18);
            }

            const totalDepositedLiquidityReadable = (Number(totalDepositedLiquidity) / 1e18).toFixed(2);

            return {
                totalDepositedLP: totalDepositedLP.toString(),
                totalDepositedLiquidityUSD: totalDepositedLiquidityReadable.toString()
            };
        } catch (error) {
            this.logger.error('Error fetching total liquidity for all pairs:', error.message);
            throw new HttpException('Failed to calculate total liquidity for all pairs', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getTotalLiquidity(chain: string, token0Symbol: string, token1Symbol: string): Promise<{ totalDepositedLP: string, totalDepositedLiquidityUSD: string }> {
        try {
            const contractAddress = MOCK_MOE_PAIR_ADDRESSES[chain];
            const provider = this.evmReader.providers.get(chain);

            const mockMoePairContract = new ethers.Contract(contractAddress, MOCK_MOE_PAIR_ABI, provider);
            const [reserveToken0, reserveToken1] = await mockMoePairContract.getReserves();
            const totalSupplyLP = await mockMoePairContract.totalSupply();

            const token0Price = await this.getTokenPrice(token0Symbol);
            const token1Price = await this.getTokenPrice(token1Symbol);

            const totalLiquidityToken0 = (BigInt(reserveToken0.toString()) * BigInt(Math.round(token0Price * 1e18))) / BigInt(1e18);
            const totalLiquidityToken1 = (BigInt(reserveToken1.toString()) * BigInt(Math.round(token1Price * 1e18))) / BigInt(1e18);
            const totalLiquidity = totalLiquidityToken0 + totalLiquidityToken1;

            const totalSupplyLPNumeric = BigInt(totalSupplyLP.toString());
            const liquidityPerLPToken = (totalLiquidity * BigInt(1e18)) / totalSupplyLPNumeric;

            const masterChefAddress = MASTER_CHEF_ADDRESSES[chain];
            const masterChefContract = new ethers.Contract(masterChefAddress, MASTER_CHEF_ABI, provider);

            const poolLength = await masterChefContract.poolLength();

            const totalDepositedPromises = [];
            for (let pid = 0; pid < poolLength; pid++) {
                totalDepositedPromises.push(masterChefContract.poolInfo(pid).then((pool: any) => pool.totalDeposited));
            }

            const totalDepositedLPArray = await Promise.all(totalDepositedPromises);

            const totalDepositedLP = totalDepositedLPArray.reduce((acc, deposited) => acc + BigInt(deposited.toString()), BigInt(0));
            const totalDepositedLiquidity = (totalDepositedLP * liquidityPerLPToken) / BigInt(1e18);
            const totalDepositedLiquidityReadable = (Number(totalDepositedLiquidity) / 1e18).toFixed(2);

            return {
                totalDepositedLP: totalDepositedLP.toString(),
                totalDepositedLiquidityUSD: totalDepositedLiquidityReadable.toString()
            };
        } catch (error) {
            this.logger.error('Error fetching total liquidity:', error.message);
            throw new HttpException('Failed to calculate total liquidity', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getPoolAPY(chain: string, pid: number): Promise<string> {
        try {
            const rewardsPerYear = await this.getRewardsPerYear(chain, pid);
            const rewardsPerYearInTokens = BigInt(rewardsPerYear) / BigInt(1e18);

            const PCHPrice = await this.getTokenPrice('PCH');

            const rewardsPerYearInUSD = Number(rewardsPerYearInTokens) * PCHPrice;

            const { totalDepositedLiquidityUSD } = await this.getTotalLiquidityForAllPairs(chain);

            const apy = (rewardsPerYearInUSD / Number(totalDepositedLiquidityUSD)) * 100;

            return apy.toFixed(4);
        } catch (error) {
            this.logger.error('Error calculating pool APY:', error.message);
            throw new HttpException('Failed to calculate APY', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getUserShare(chain: string, pid: number, user: string): Promise<string> {
        try {
            const masterChefAddress = MASTER_CHEF_ADDRESSES[chain];
            const provider = this.evmReader.providers.get(chain);
            const masterChefContract = new ethers.Contract(masterChefAddress, MASTER_CHEF_ABI, provider);

            const poolInfo = await masterChefContract.poolInfo(pid);
            const totalDeposited = BigInt(poolInfo.totalDeposited.toString());

            const userInfo = await masterChefContract.userToPoolInfo(pid, user);
            const userDeposited = BigInt(userInfo.amount.toString());

            if (totalDeposited === BigInt(0) || userDeposited === BigInt(0)) {
                return '0.0000';
            }
            const userShare = (userDeposited * BigInt(100000000)) / totalDeposited;
            const userSharePercentage = (Number(userShare) / 1000000).toFixed(4);

            return userSharePercentage;
        } catch (error) {
            this.logger.error('Error calculating user share:', error.message);
            throw new HttpException('Failed to calculate user share', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }


    async getTotalTokens(): Promise<TotalTokenResponseData[]> {
        const data: any = await this.prisma.getTotalTokensData();
        return data.map(item => ({
            name: item.token_name,
            address: item.address,
            totalBalance: item.total_balance.toString(),
            chainId: item.chain_id,
            chain: CHAIN_NAMES[item.chain_id],
        }));
    }

    async getWalletTokens(chain: string, walletAddress: string): Promise<WalletTokenResponseData[]> {
        const approvedTokens: Token[] = await this.getAllTokenMetadata(chain);
        const syTokens: AncillaryToken[] = await this.prisma.getAncillaryTokens(chain);
        let isTokenBoundAddress = false;
        try {
            isTokenBoundAddress = await this.tokenbound.isAccountDeployed(chain, walletAddress);
        } catch (error) {
            this.logger.error('Failed to fetch tokenbound status', error);
        }

        const ancillaryTokenAddresses = [...syTokens.map(data => data.address), ...EXTRA_WITHDRAWABLE_TOKENS[chain]];
        const [onChainWalletTokenData, onChainAncillaryTokenData]: [MoralisWalletToken[], MoralisWalletToken[]] =
            await Promise.all([
                this.moralis.getWalletTokenBalances(chain, walletAddress, approvedTokens.map(data => data.address)),
                this.moralis.getWalletTokenBalances(chain, walletAddress, ancillaryTokenAddresses),
            ]);

        const cachedWalletTokenData: WalletToken[] = await this.prisma.getWalletTokenBalances(chain, walletAddress);
        const freshWalletTokenData = this.generateFreshWalletTokenData(walletAddress,
            approvedTokens, cachedWalletTokenData, onChainWalletTokenData);

        if (isTokenBoundAddress) {
            await this.prisma.setWalletTokenBalances(freshWalletTokenData);
        }

        const approvedTokenResponse = this.formatForResponse(freshWalletTokenData, approvedTokens);
        const ancillaryTokenResponse = this.formatForAncillaryResponse(onChainAncillaryTokenData, syTokens, chain);
        return [...approvedTokenResponse, ...ancillaryTokenResponse];
    }

    async getAllTokenMetadata(chain: string): Promise<Token[]> {
        return await this.prisma.getApprovedTokens(chain);
    }

    async getTokenTransactions(chain: string, walletAddress: string) {
        let cursor = null;
        const history = [];
        do {
            const response = await this.moralis.getWalletERC20Transfers(chain, walletAddress, MICHI_START_DATES[chain], new Date(), cursor);
            cursor = response.cursor;
            history.push(...this.formatTxData(response.result, walletAddress, chain));
        } while (cursor != null);
        return history;
    }

    private formatTxData(transactions: any[], walletAddress: string, chain: string) {
        return transactions.map(tx => ({
            transactionType: tx.to_address.toLowerCase() == walletAddress.toLowerCase() ? 'deposit' : 'withdrawal',
            tokenAddress: tx.address,
            name: tx.token_name,
            symbol: tx.token_symbol,
            amount: tx.value_decimal,
            timestamp: tx.block_timestamp,
            link: `${SCANNER_BASE_TX_URLS[chain]}/${tx.transaction_hash}`,
        }));
    }

    private generateFreshWalletTokenData(
        walletAddress: string,
        approvedTokens: Token[],
        cachedWalletTokenData: WalletToken[],
        onChainWalletTokenData: MoralisWalletToken[],
    ): Prisma.WalletTokenUncheckedCreateInput[] {
        const data = [];
        const onChainDataAddresses = onChainWalletTokenData.map(data => data.token_address);
        const cachedDataAddresses = cachedWalletTokenData.map(data => data.token_address);
        for (const token of approvedTokens) {
            let balance = '0', eligibleForInterest = false;

            if (cachedDataAddresses.includes(token.address)) {
                eligibleForInterest = cachedWalletTokenData.find(wtData => wtData.token_address == token.address).has_accrued_interest == true;
            }

            if (onChainDataAddresses.includes(token.address)) {
                balance = onChainWalletTokenData.find(d => d.token_address === token.address).balance;
            }

            data.push(this.buildTokenData(balance, walletAddress, token, eligibleForInterest));
        }
        return data;
    }

    private buildTokenData(
        balance: string,
        walletAddress: string,
        token: Token,
        hasAccruedInterest: boolean,
    ): Prisma.WalletTokenUncheckedCreateInput {
        return {
            chain_id: token.chain_id,
            wallet_address: walletAddress,
            token_address: token.address,
            balance: balance,
            eligible_balance: balance,
            stale_at: new Date(new Date().getTime() + FIFTEEN_SECONDS),
            has_accrued_interest: (new BigNumber(balance) > new BigNumber(0)) || hasAccruedInterest,
        };
    }

    private formatForResponse(
        walletTokenData: Prisma.WalletTokenUncheckedCreateInput[],
        tokenData: Token[],
    ): WalletTokenResponseData[] {
        const data = [];
        for (const walletToken of walletTokenData) {
            const token = tokenData.find(d => d.address === walletToken.token_address);
            const walletData = {
                chainId: walletToken.chain_id,
                tokenAddress: token.address,
                name: token.name,
                symbol: token.symbol,
                balance: walletToken.balance,
                decimals: token.decimals,
            };
            if (walletToken.has_accrued_interest != null) {
                walletData['has_accrued_interest'] = walletToken.has_accrued_interest;
            }
            data.push(walletData);
        }
        return data;
    }

    private formatForAncillaryResponse(
        walletTokenData: MoralisWalletToken[],
        tokenData: Token[],
        chain: string,
    ): WalletTokenResponseData[] {
        const data = [];
        for (const walletToken of walletTokenData) {
            data.push({
                chainId: chain,
                tokenAddress: walletToken.token_address,
                name: walletToken.name,
                symbol: walletToken.symbol,
                balance: walletToken.balance,
                decimals: walletToken.decimals,
            });
        }
        return data;
    }
}