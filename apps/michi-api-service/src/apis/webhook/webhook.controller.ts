import { Body, Controller, Logger, Post } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { MichiEvent } from '@app/models';

import type { IWebhook } from '@moralisweb3/streams-typings';

@Controller({version: ['1'], path: 'webhooks'})
export class WebhookController {
    private readonly logger = new Logger(WebhookController.name);

    constructor(
        private readonly webhookService: WebhookService,
    ) {}

    @Post('moralis/walletCreated')
    async handleWalletCreatedEvent(@Body() body: IWebhook) {
        if (body?.confirmed) {
            await this.webhookService.handleEvent(body, MichiEvent.WALLET_CREATED);
        }
        return { status: 'ok' };
    }

    @Post('moralis/deposit')
    async handleDepositEvent(@Body() body: IWebhook) {
        if (body?.confirmed) {
            await this.webhookService.handleEvent(body, MichiEvent.DEPOSIT);
        }
        return { status: 'ok' };
    }

    @Post('moralis/walletPurchased')
    async handleWalletPurchasedEvent(@Body() body: IWebhook) {
        if (body?.confirmed) {
            await this.webhookService.handleEvent(body, MichiEvent.WALLET_PURCHASED);
        }
        return { status: 'ok' };
    }

    @Post('moralis/ordersCancelled')
    async handleOrdersCancelledEvent(@Body() body: IWebhook) {
        if (body?.confirmed) {
            await this.webhookService.handleEvent(body, MichiEvent.ORDERS_CANCELLED);
        }
        return { status: 'ok' };
    }

    @Post('moralis/allOrdersCancelled')
    async handleAllOrdersCancelledEvent(@Body() body: IWebhook) {
        if (body?.confirmed) {
            await this.webhookService.handleEvent(body, MichiEvent.ALL_ORDERS_CANCELLED);
        }
        return { status: 'ok' };
    }
}