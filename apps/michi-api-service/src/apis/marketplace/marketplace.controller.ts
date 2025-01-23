import { Controller, Post, Body, Get, Query, Param } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { CancelOrdersDto, GetOrderDto, GetOrderOnWalletDto, GetSaleDto } from './marketplace.dto';
import { Prisma } from '@prisma/client';
import { CreateOrderDto } from '@app/models';

@Controller({version: ['1'], path: 'marketplace'})
export class MarketplaceController {
    constructor(private readonly marketplaceService: MarketplaceService) {}

    @Post('order')
    async createOrder(@Body() createOrderDto: CreateOrderDto) {
        return await this.marketplaceService.createOrder(createOrderDto);
    }

    @Post('cancel')
    async markOrdersAsPendingCancellation(@Body() cancelOrdersDto: CancelOrdersDto) {
        return await this.marketplaceService.markOrdersAsPendingCancellation(
            cancelOrdersDto.chainId, cancelOrdersDto.hash, cancelOrdersDto.isCancelAll);
    }

    @Get('orders')
    async getOrders(@Query() query: GetOrderDto) {
        return await this.marketplaceService.getOrders(query);
    }

    @Get('orders/:chain/:id')
    async getOrdersOnWallet(@Param('chain') chain: string, @Param('id') id: string, @Query() query: GetOrderOnWalletDto) {
        return await this.marketplaceService.getOrdersOnWallet(chain, id, query);
    }

    @Post('sales')
    async createSale(@Body() sale: Prisma.SaleUncheckedCreateInput) {
        return await this.marketplaceService.createSale(sale);
    }

    @Get('sales')
    async getSales(@Query() query: GetSaleDto) {
        return await this.marketplaceService.getSales(query);
    }
}
