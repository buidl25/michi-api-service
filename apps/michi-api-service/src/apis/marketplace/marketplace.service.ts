import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/db';
import { GetOrderDto, GetOrderOnWalletDto, GetSaleDto } from './marketplace.dto';
import { MichiWallet, Order, OrderType, Prisma} from '@prisma/client';
import { PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE } from '@app/constants';
import { PointsService } from '../points/points.service';
import { convertEpochToDate } from '@app/utils';
import { BigNumber } from '@moralisweb3/core';
import { TokensService } from '../tokens/tokens.service';
import { MoralisService } from '@app/moralis';

import * as ORDERS_CANCELLED from '@app/config/abi/orders-cancelled-event-abi.json';
import * as ALL_ORDERS_CANCELLED from '@app/config/abi/all-orders-cancelled-event-abi.json';
import { ethers } from 'ethers';
import { CreateOrderDto, OrderStatus } from '@app/models';

const KEYS_TO_SKIP = ['ownerAddress', 'limit', 'offset'];

@Injectable()
export class MarketplaceService {
    private readonly logger = new Logger(MarketplaceService.name);

    constructor(
      private readonly prisma: PrismaService,
      private readonly pointsService: PointsService,
      private readonly tokenService: TokensService,
      private readonly moralis: MoralisService
    ) {}

    async createOrder(createOrderDto: CreateOrderDto) {
        await this.validateOrder(createOrderDto);
        try {
            const order = await this.prisma.createOrder(createOrderDto);
            this.logger.log(`Created order: ${order}`);
            await this.markStaleExistingOrdersOnSameWallet(createOrderDto, order);
            const chainId = createOrderDto.chainId.toLowerCase();
            const participant = createOrderDto.participant.toLowerCase();
            const userNonce = await this.prisma.getUserNonce(chainId, participant);
            if (createOrderDto.nonce > userNonce) {
                await this.prisma.setUserNonce(chainId, participant, createOrderDto.nonce);
            }

            // Save current point totals in db at time of order for up to date fetching
            await this.pointsService.getThirdPartyPoints(order.wallet.wallet_address);
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE
            ) {
                throw new HttpException({
                    message: 'Duplicate nonce'
                }, HttpStatus.CONFLICT);
            } else if (error instanceof Prisma.PrismaClientValidationError) {
                throw new BadRequestException('Invalid parameters.');
            }
            throw error;
        }

        return 'Order created successfully';
    }

    async deleteOrder(
        chaindId: string,
        buyerAddress: string,
        sellerAddress: string,
        nonce: BigNumber,
        tokenId: BigNumber,
        collection: string
    ) {
        this.logger.log(`Deleting order with chainId: ${chaindId}, participant in: [${buyerAddress}, ${sellerAddress}], nonce: ${nonce}, tokenId: ${tokenId}, collection: ${collection}`);
        await this.prisma.deleteOrder({
            chainId: chaindId,
            participant: { in: [buyerAddress, sellerAddress] },
            nonce: parseInt(nonce.toString()),
            collection: collection,
            tokenId: parseInt(tokenId.toString())
        });
    }

    async cancelOrders(chainId: string, userAddress: string, nonces: BigNumber[]) {
        this.logger.log(`Cancelling order nonces ${nonces} for user ${userAddress} on chain ${chainId}`);
        const result = await this.prisma.cancelOrders({
            chainId: chainId,
            participant: userAddress.toLowerCase(),
            nonce: { in: nonces.map(nonce => parseInt(nonce.toString())) }
        });
        this.logger.log(`Cancel orders result: ${JSON.stringify(result)}`);
        try {
            await this.markUnstaleExistingOrdersOnSameWallets(chainId, userAddress, nonces.map(nonce => parseInt(nonce.toString())));
        } catch (e) {
            this.logger.error(`Couldn't unstale orders: ${e}`);
        }
    }

    async markOrdersAsPendingCancellation(chainId: string, hash: string, isCancelAll: boolean) {
        const where = await this.processCancellationTx(chainId, hash, isCancelAll);
        await this.prisma.markOrdersAsPendingCancellation(where);

        return 'Successfully marked orders as processing cancellation';
    }

    private async processCancellationTx(chainId: string, hash: string, isCancelAll: boolean) {
        try {
            const result = await this.moralis.getTransaction(chainId, hash);
            return isCancelAll ? this.processCancelAllTx(chainId, result) : this.processCancelTx(chainId, result);
        } catch (e) {
            throw new HttpException({ message: 'Unable to process transaction.'}, HttpStatus.NOT_FOUND);
        }
    }

    private processCancelTx(chainId: string, result: any) {
        const iface = new ethers.Interface([ORDERS_CANCELLED]);
        const decodedLog = iface.parseLog({
            topics: [result.logs[0].topic0],
            data: result.logs[0].data
        });
        const participant = decodedLog.args[0];
        const nonces = decodedLog.args[1].toArray().map(i => parseInt(i));
        this.logger.log(`Marking order nonces ${nonces} as PROCESSING_CANCELLATION for user ${participant} on chain ${chainId}`);
        return {
            chainId: chainId,
            participant: participant,
            nonce: {in: nonces }
        };
    }

    private processCancelAllTx(chainId: string, result: any) {
        const iface = new ethers.Interface([ALL_ORDERS_CANCELLED]);
        const decodedLog = iface.parseLog({
            topics: [result.logs[0].topic0],
            data: result.logs[0].data
        });
        const participant = decodedLog.args[0];
        const minNonce = parseInt(decodedLog.args[1]);
        this.logger.log(`Marking order nonces lt ${minNonce} as PROCESSING_CANCELLATION for user ${participant} on chain ${chainId}`);
        return {
            chainId: chainId,
            participant: participant,
            nonce: {lt: minNonce }
        };
    }

    async cancelOrdersForUser(chainId: string, userAddress: string, minNonce: BigNumber) {
        this.logger.log(`Cancelling order nonces below ${minNonce} for user ${userAddress} on chain ${chainId}`);
        await this.prisma.cancelOrders({
            chainId: chainId,
            participant: userAddress.toLowerCase(),
            nonce: { lt: parseInt(minNonce.toString()) }
        });
        const minNonceNumber = parseInt(minNonce.toString());
        try {
            await this.markUnstaleExistingOrdersOnSameWallets(chainId, userAddress, [...Array(minNonceNumber).keys()]);
        } catch (e) {
            this.logger.error(`Couldn't unstale orders: ${e}`);
        }
    }

    async getOrders(filters: GetOrderDto) {
        const where: Prisma.OrderWhereInput = {};

        for (const [key, value] of Object.entries(filters)) {
            if (value === undefined || KEYS_TO_SKIP.includes(key)) continue;
            
            switch (key) {
                case 'tokenId':
                case 'nonce':
                    where[key] = Number(value);
                    break;
                default:
                    where[key] = value;
            }
        }

        const limit = filters.limit == null ? 100 : filters.limit;
        const offset = filters.offset == null ? 0 : filters.offset;
        const orders = await this.prisma.getNonStaleOrders(limit, offset, where, filters.ownerAddress);
        const res = [];

        for (const order of orders) {
            const cachedPoints = await this.pointsService.getCachedThirdPartyPoints(order.wallet.wallet_address);

            res.push({
                ...order, 
                amount: order.amount.toFixed(),
                points: this.pointsService.buildPointsResponseDataFromRawPointsDataType(cachedPoints)
            });
        }
        return res;
    }

    async getOrdersOnWallet(chainId: string, walletId: string, filters: GetOrderOnWalletDto) {
        return await this.prisma.getOrdersByCriteria({
            chainId: chainId,
            tokenId: parseInt(walletId),
            status: { in : [OrderStatus.ACTIVE.toString(), OrderStatus.PROCESSING_CANCELLATION.toString()] }, 
            ...filters
        });
    }

    async createSale(sale: Prisma.SaleUncheckedCreateInput) {
        try {
            await this.prisma.createSale(sale);
        } catch (error) {
            this.logger.error('Unable to create sale', error);
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE
            ) {
                throw new HttpException({
                    message: 'Duplicate nonce'
                }, HttpStatus.CONFLICT);
            } else if (error instanceof Prisma.PrismaClientValidationError) {
                throw new BadRequestException('Invalid parameters.');
            }
            throw error;
        }
    }

    async getSales(filters: GetSaleDto) {
        const where: Prisma.SaleWhereInput = {};

        for (const [key, value] of Object.entries(filters)) {
            if (value == undefined || key == 'points') continue;

            if (key == 'startDate') {
                where.date = {...(where.date as Prisma.DateTimeFilter), gte: new Date(value)};
            } else if (key == 'endDate') {
                where.date = {...(where.date as Prisma.DateTimeFilter), lte: new Date(value)};
            } else if (key == 'tokenId') {
                where.tokenId = Number(value);
            } else if (key == 'points') {
                where.points = { array_contains: value };
            } else {
                where[key] = value; 
            }
        }

        const potentialMatches = await this.prisma.sale.findMany({ where });

        if (filters.points) {
            return potentialMatches.filter(sale => 
                filters.points.every(point =>
                    (sale.points as any[]).some((jsonItem: any) => jsonItem.platform.toLowerCase() === point.toLowerCase())
                )
            );
        }

        return potentialMatches;
    }

    private async validateOrder(createOrderDto: CreateOrderDto) {
        const wallet = await this.validateWalletOwnership(createOrderDto);
        await this.validateNoTokensInWallet(createOrderDto, wallet);
        await this.validateExistingOrder(createOrderDto);

        if (convertEpochToDate(createOrderDto.expiry) < new Date()) {
            throw new BadRequestException('Expiration must be set to a future date.');
        }

    }

    private async validateWalletOwnership(createOrderDto: CreateOrderDto) {
        const wallet = await this.prisma.getMichiWallet(createOrderDto.chainId, createOrderDto.tokenId);
        if (!wallet) {
            throw new HttpException({ message: 'Wallet does not exist.'}, HttpStatus.NOT_FOUND);
        } else if (createOrderDto.type === OrderType.BID && createOrderDto.participant.toLowerCase() === wallet.owner_address.toLowerCase()) {
            throw new HttpException({ message: 'Cannot bid on a wallet you already own.'}, 420);
        } else if (createOrderDto.type === OrderType.LISTING && createOrderDto.participant.toLowerCase() !== wallet.owner_address.toLowerCase()) {
            throw new HttpException({ message: 'You do not own this wallet.'}, 421);
        }
        return wallet;
    }

    private async validateNoTokensInWallet(createOrderDto: CreateOrderDto, wallet: MichiWallet) {
        if (createOrderDto.type !== OrderType.LISTING) {
            return;
        }

        const walletTokens = await this.tokenService.getWalletTokens(createOrderDto.chainId, wallet.wallet_address);
        for (const walletToken of walletTokens) {
            if (new Prisma.Decimal(walletToken.balance).greaterThan(0)) {
                throw new HttpException({ message: 'Wallet contains tokens.'}, 422);
            }
        }
    }

    private async validateExistingOrder(createOrderDto: CreateOrderDto) {
        const existingOrders = await this.getUserOrdersOnWallet(createOrderDto);
        const newAmount = new Prisma.Decimal(createOrderDto.amount);

        for (const order of existingOrders) {
            if (order.type === createOrderDto.type) {
                if (order.type === OrderType.BID && order.amount.greaterThanOrEqualTo(newAmount)) {
                    throw new HttpException({ message: 'You have an existing bid of equal or higher value for this wallet.'}, 423);
                } else if (order.type === OrderType.LISTING && order.amount.lessThanOrEqualTo(newAmount)) { 
                    throw new HttpException({ message: 'You have an existing listing of equal or lower value for this wallet.'}, 424);
                } else if (order.type === OrderType.LISTING && order.currency !== createOrderDto.currency.toLowerCase()) {
                    throw new HttpException({ message: 'You have an existing listing using a different currency for this wallet.'}, 425);
                }
            }
        }
    }

    private async markStaleExistingOrdersOnSameWallet(createOrderDto: CreateOrderDto, createdOrder: Order) {
        const existingOrders = await this.getUserOrdersOnWallet(createOrderDto, false);
        const newAmount = new Prisma.Decimal(createOrderDto.amount);
    
        const ordersToMarkStale = existingOrders.filter(order => 
            order.type === createOrderDto.type && (
                (order.type === OrderType.BID && order.amount.lessThanOrEqualTo(newAmount) && order.currency == createOrderDto.currency.toLowerCase()) ||
                (order.type === OrderType.LISTING && order.amount.greaterThanOrEqualTo(newAmount))
            ) && order.id !== createdOrder.id
        );
    
        await Promise.all(ordersToMarkStale.map(order => this.prisma.updateOrderStaleness(order.id, true)));
    }

    private async markUnstaleExistingOrdersOnSameWallets(chainId: string, userAddress: string, nonces: number[]) {
        const cancelledOrders = await this.prisma.getOrdersByCriteria({
            chainId: chainId,
            participant: userAddress,
            nonce: {in: nonces}
        });

        const otherUserOrders = await this.prisma.getOrdersByCriteria({
            chainId: chainId,
            participant: userAddress,
            status: { in: [OrderStatus.ACTIVE, OrderStatus.PROCESSING_CANCELLATION] },
            tokenId: {in: cancelledOrders.map(order => order.tokenId)}
        });

        const groupedListings: { [key: string]: Order[] } = this.groupOrdersOnWalletId(otherUserOrders, OrderType.LISTING);
        const groupedBids: { [key: string]: Order[] } = this.groupOrdersOnWalletId(otherUserOrders, OrderType.BID);
        
        const listingsToUnstale = this.getOrdersToUnstale(groupedListings);
        const bidsToUnstale = this.getOrdersToUnstale(groupedBids);

        await this.prisma.updateOrdersStaleness([...listingsToUnstale, ...bidsToUnstale]
            .map(order => order.id), false);
    }

    private getOrdersToUnstale(ordersMap: { [key: string]: Order[] }) {
        const smallestOrders = [];
        for (const key in ordersMap) {
            const orderGroup = ordersMap[key];
            const currencyGroups: { [currency: string]: Order[] } = {};
        
            // Group orders by currency
            for (const order of orderGroup) {
                if (!currencyGroups[order.currency]) {
                    currencyGroups[order.currency] = [];
                }
                currencyGroups[order.currency].push(order);
            }
        
            // Find smallest order for each currency
            for (const currency in currencyGroups) {
                const currencyGroup = currencyGroups[currency];
                let smallestOrder = currencyGroup[0];
                        
                for (let i = 1; i < currencyGroup.length; i++) {
                    if (currencyGroup[i].amount < smallestOrder.amount) {
                        smallestOrder = currencyGroup[i];
                    }
                }
                        
                smallestOrders.push(smallestOrder);
            }
        }
        return smallestOrders;
    }

    private groupOrdersOnWalletId(orders: Order[], type: OrderType) {
        return orders.reduce((acc, order) => {
            const key = `${order.chainId}-${order.tokenId}`;
            if (order.type == type) {
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push(order);
            }
            return acc;
        }, {});
    }

    private async getUserOrdersOnWallet(createOrderDto: CreateOrderDto, includeStale=true) {
        const where = {
            tokenId: createOrderDto.tokenId, 
            participant: createOrderDto.participant.toLowerCase(), 
            status: { in : [OrderStatus.ACTIVE.toString(), OrderStatus.PROCESSING_CANCELLATION.toString()] }, 
        };
        if (!includeStale) {
            where['isStale'] = false;
        }
        return await this.prisma.getOrdersByCriteria(where);
    }
}
