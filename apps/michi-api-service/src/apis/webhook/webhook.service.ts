import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BigNumber as BN } from '@moralisweb3/core';
import { EIGENLAYER, FIFTEEN_SECONDS, MICHI_WALLET_NFTS_ADDRESSES, ThirdPartyPlatform } from '@app/constants';
import { PrismaService } from '@app/db';
import { MoralisService } from '@app/moralis';
import { AllOrdersCancelledEvent, DepositEvent, MichiEvent, OrdersCancelledEvent, ThirdPartyRawPointsData, WalletCreatedEvent, WalletPurchasedEvent } from '@app/models';
import BigNumber from 'bignumber.js';
import { CommonService } from '@app/common';
import type { IWebhook } from '@moralisweb3/streams-typings';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { ThirdPartyPointsService } from '@app/3pp';
import { TokenboundService } from '@app/tokenbound';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);

    constructor(
        private readonly moralis: MoralisService,
        private readonly prisma: PrismaService,
        private readonly common: CommonService,
        private readonly marketplace: MarketplaceService,
        private readonly thirdPartyPoints: ThirdPartyPointsService,
        private readonly tokenBound: TokenboundService
    ) {}

    async handleEvent(eventData: IWebhook, eventType: MichiEvent) {
        const txHash = eventData?.logs[0]?.transactionHash;
        if (!txHash || (await this.prisma.getProcessedMoralisEvent(txHash))) {
            return;
        } else {
            await this.prisma.setProcessedMoralisEvent(txHash);
        }

        this.logger.log(`Received ${eventType} event on chain ${eventData.chainId}`);

        switch (eventType) {
            case MichiEvent.WALLET_CREATED:
                return await this.handleWalletCreatedEvent(eventData);
            case MichiEvent.DEPOSIT:
                return await this.handleDepositEvent(eventData);
            case MichiEvent.WALLET_PURCHASED:
                return await this.handleWalletPurchasedEvent(eventData);
            case MichiEvent.ORDERS_CANCELLED:
                return await this.handleOrdersCancelledEvent(eventData);
            case MichiEvent.ALL_ORDERS_CANCELLED:
                return await this.handleAllOrdersCancelledEvent(eventData);
            default:
                this.logger.error(`Unhandled event type: ${eventType}`);
                return;
        }
    }

    private async handleWalletCreatedEvent(eventData: IWebhook) {
        const parsedData: WalletCreatedEvent[] = this.moralis.parseWalletCreatedData(eventData);
        const event = parsedData[0];
        this.logger.log(`Parsed event data: ${JSON.stringify(event)}`);

        const nftIndex = parseInt(event.tokenId.toString(), 10);
        const currentNFTIndex = await this.prisma.getCurrentNftIndex(eventData.chainId);
        if (nftIndex > currentNFTIndex + 1) {
            this.logger.log(`Index ${nftIndex} is more than 1 above currentNFTIndex ${currentNFTIndex}. Backfilling missing data.`);
            await this.common.backfillMissingWalletCreates(eventData.chainId, currentNFTIndex + 1, nftIndex);
        }

        const newWallet: Prisma.MichiWalletUncheckedCreateInput = {
            chain_id: eventData.chainId,
            nft_index: nftIndex,
            wallet_address: event.walletAddress,
            owner_address: event.sender,
            stale_at: new Date(new Date().getTime() + FIFTEEN_SECONDS)
        };
        await this.prisma.setMichiWallets([newWallet]);

        this.logger.log(`Saved new wallet - nft_index: ${newWallet.nft_index}, wallet_address: ${newWallet.wallet_address}, owner: ${newWallet.owner_address}`);
    }

    private async handleDepositEvent(eventData: IWebhook) {
        const parsedData: DepositEvent[] = this.moralis.parseDepositData(eventData);
        const event = parsedData[0];
        const currentToken = await this.prisma.getWalletTokenBalance(eventData.chainId, event.walletAddress, event.token);

        let currentBalance = new BigNumber(0), currentEligibleBalance = new BigNumber(0);
        if (currentToken) {
            currentBalance = new BigNumber(currentToken.balance.toString());
            currentEligibleBalance = new BigNumber(currentToken.eligible_balance.toString());
        }

        const newTokenBalance: Prisma.WalletTokenUncheckedCreateInput = {
            chain_id: eventData.chainId,
            wallet_address: event.walletAddress,
            token_address: event.token,
            balance: currentBalance.plus(event.amountAfterFees.toString()).toString(),
            eligible_balance: currentEligibleBalance.plus(event.amountAfterFees.toString()).toString(),
            stale_at: new Date(new Date().getTime() + FIFTEEN_SECONDS)
        };
        await this.prisma.setWalletTokenBalances([newTokenBalance]);

        this.logger.log(`Updated token balance from ${currentBalance} to ${newTokenBalance.balance} - chainId: ${eventData.chainId}, wallet_address: ${event.walletAddress}, token_address: ${event.token}`);
    }

    private async handleWalletPurchasedEvent(eventData: IWebhook) {
        const parsedData: WalletPurchasedEvent[] = this.moralis.parseWalletPurchasedData(eventData);
        const event = parsedData[0];
        this.logger.log(`Parsed event data: ${JSON.stringify(event)}`);
        
        const salePoints = await this.getSalePoints(eventData.chainId, event.collection, event.tokenId);
        const collection = event.collection.toLowerCase();
        const currency = event.currency.toLowerCase();
        const buyer = event.buyer.toLowerCase();
        const seller = event.seller.toLowerCase();
        const tokenId = event.tokenId;

        const sale = await this.marketplace.createSale({
            collection,
            currency,
            buyerAddress: buyer,
            sellerAddress: seller,
            chainId: eventData.chainId,
            tokenId: parseInt(tokenId.toString()),
            amount: event.amount.toString(),
            date: new Date(),
            points: salePoints
        });
        this.logger.log(`Created new sale: ${JSON.stringify(sale)}`);

        await this.marketplace.deleteOrder(eventData.chainId, buyer, seller, event.nonce, tokenId, collection);
    }

    private async handleOrdersCancelledEvent(eventData: IWebhook) {
        const parsedData: OrdersCancelledEvent[] = this.moralis.parseOrdersCancelledEvents(eventData);
        const event = parsedData[0];
        this.logger.log(`Parsed event data: ${JSON.stringify(event)}`);

        await this.marketplace.cancelOrders(eventData.chainId, event.user, event.orderNonces);
    }

    private async handleAllOrdersCancelledEvent(eventData: IWebhook) {
        const parsedData: AllOrdersCancelledEvent[] = this.moralis.parseAllOrdersCancelledEvent(eventData);
        const event = parsedData[0];
        this.logger.log(`Parsed event data: ${JSON.stringify(event)}`);

        await this.marketplace.cancelOrdersForUser(eventData.chainId, event.user, event.minNonce);
    }

    private async getSalePoints(chainId: string, collection: string, tokenId: BN) {
        if (collection.toLowerCase() !== MICHI_WALLET_NFTS_ADDRESSES[chainId].toLowerCase()) {
            throw new Error(`Unhandled collection in webhook event: ${collection}`);
        }

        const address = this.tokenBound.getAccount(chainId, tokenId.toString());
        const rawPointsData: ThirdPartyRawPointsData[] = await this.thirdPartyPoints.fetchThirdPartyPointTotalsWithRetries(
            address, Object.values(ThirdPartyPlatform));

        const result = [];

        let totalElPoints = new BigNumber(0);

        for (const platformData of rawPointsData) {
            if (platformData.elPoints) {
                totalElPoints = totalElPoints.plus(new BigNumber(platformData.elPoints));
            }
            result.push({
                platform: platformData.platform,
                points: platformData.points.toString()
            });
        }
        result.push({
            platform: EIGENLAYER,
            points: totalElPoints.toString()
        });

        return result;
    }
}