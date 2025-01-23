import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@app/db';
import { Prisma, ThirdPartyPoints, Token, WalletToken } from '@prisma/client';
import { MoralisService } from '@app/moralis';
import { MichiWalletResponseData, MoralisNFT, NFTInfo, WalletTokenResponseData } from '@app/models';
import { CHAIN_NAMES, FIFTEEN_SECONDS, LIVE_CHAIN_IDS } from '@app/constants';
import { TokenboundService } from '@app/tokenbound';
import Decimal from 'decimal.js';
import { PointsService } from '../points/points.service';

@Injectable()
export class NFTService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly moralis: MoralisService,
        private readonly tokenbound: TokenboundService,
        private readonly pointsService: PointsService,
    ) {
    }

    async getTotalMichiWallets() {
        return this.prisma.getTotalMichiWallets();
    }

    async getOwnedMichiWallets(ownerAddress: string) {
        const results = await Promise.all(LIVE_CHAIN_IDS.map(chainId => this.getOwnedMichiWalletsOnChain(chainId, ownerAddress)));
        return results.flat();
    }

    async getOwnedMichiWalletsOnChain(chain: string, ownerAddress: string) {
        let ownedWallets: Prisma.MichiWalletUncheckedCreateInput[] = await this.prisma.getMichiWallets(chain, ownerAddress);
        if (ownedWallets.length == 0 || ownedWallets.some(wallet => new Date() > wallet.stale_at)) {
            const actualNFTs = await this.moralis.getWalletNFTs(chain, ownerAddress);
            ownedWallets = await this.generateFreshWalletData(chain, actualNFTs, ownedWallets);
            await this.prisma.setMichiWallets(ownedWallets);
        }

        const ownedWalletAddresses = ownedWallets.map(wallet => wallet.wallet_address);
        const walletOwnedTokens = await this.prisma.getWalletTokenBalancesBatched(chain, ownedWalletAddresses);
        const walletPoints = await this.prisma.getThirdPartyPointsBulk(ownedWalletAddresses);
        const approvedTokens: Token[] = await this.prisma.getApprovedTokens(chain);

        return await this.buildResponse(ownedWallets, walletOwnedTokens, walletPoints, approvedTokens, chain);
    }

    async lookupWalletNFTInfo(walletAddress: string) {
        const wallet = await this.prisma.getMichiWalletByAddressOnly(walletAddress);
        if (wallet) {
            return {
                chainId: wallet.chain_id,
                chainName: CHAIN_NAMES[wallet.chain_id],
                nftIndex: wallet.nft_index.toString(),
            };
        } else {
            throw new BadRequestException('Address is not a Michi Wallet');
        }
    }


    private async generateFreshWalletData(
        chain: string,
        nfts: NFTInfo[],
        cachedWalletData: Prisma.MichiWalletUncheckedCreateInput[],
    ): Promise<Prisma.MichiWalletUncheckedCreateInput[]> {
        const dbData = [];
        for (const nftData of nfts) {
            const cachedNFTData = cachedWalletData.find(d => d.nft_index === parseInt(nftData.token_id));
            const walletAddress = cachedNFTData
                ? cachedNFTData.wallet_address
                : this.tokenbound.getAccount(chain, nftData.token_id);
            dbData.push({
                chain_id: chain,
                nft_index: parseInt(nftData.token_id),
                wallet_address: walletAddress,
                owner_address: nftData.owner_of,
                stale_at: new Date(new Date().getTime() + FIFTEEN_SECONDS),
            });
        }
        return dbData;
    }

    private async buildResponse(
        michiWallets: Prisma.MichiWalletUncheckedCreateInput[],
        walletTokens: WalletToken[],
        walletPoints: ThirdPartyPoints[],
        tokenMetadata: Token[],
        chain: string,
    ): Promise<MichiWalletResponseData[]> {
        if (michiWallets.length == 0) return [];

        const walletListings = await this.prisma.getListingsForWallets(michiWallets, chain);

        const walletTokenMap = {};
        for (const token of walletTokens) {
            (walletTokenMap[token.wallet_address] = walletTokenMap[token.wallet_address] || []).push(token);
        }

        const walletPointMap = {};
        for (const point of walletPoints) {
            (walletPointMap[point.address] = walletPointMap[point.address] || []).push(point);
        }

        const response = michiWallets.map(wallet => {
            const listing = walletListings.find(l => l.tokenId == wallet.nft_index);
            return {
                chainId: wallet.chain_id,
                walletAddress: wallet.wallet_address,
                nftIndex: wallet.nft_index.toString(),
                tokens: this.buildTokensResponseData(walletTokenMap[wallet.wallet_address], tokenMetadata),
                points: this.pointsService.buildPointsResponseData(walletPointMap[wallet.wallet_address]),
                price: listing ? listing.amount.toFixed() : null,
                currency: listing ? listing.currency : null,
            };
        });

        return response;
    }

    // TODO: factor duplicated code from other endpoints for token response data
    private buildTokensResponseData(
        walletTokenData: Prisma.WalletTokenUncheckedCreateInput[],
        tokenMetadata: Token[],
    ): WalletTokenResponseData[] {
        if (!walletTokenData) return [];
        const data = [];
        for (const walletToken of walletTokenData) {
            const token = tokenMetadata.find(d => d.address === walletToken.token_address);
            if (walletToken.balance > new Decimal(0)) {
                data.push({
                    chainId: walletToken.chain_id,
                    tokenAddress: token.address,
                    name: token.name,
                    symbol: token.symbol,
                    balance: walletToken.balance,
                    decimals: token.decimals,
                    eligibleForInterest: walletToken.has_accrued_interest,
                });
            }
        }
        return data;
    }
}