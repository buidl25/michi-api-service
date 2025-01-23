import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { PrismaModule } from '@app/db';
import { MoralisModule } from '@app/moralis';
import { CommonModule } from '@app/common';
import { TokenboundModule } from '@app/tokenbound';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { ThirdPartyPointsModule } from '@app/3pp';

@Module({
    imports: [
        PrismaModule,
        MoralisModule,
        CommonModule,
        TokenboundModule,
        MarketplaceModule,
        ThirdPartyPointsModule
    ],
    providers: [WebhookService],
    exports: [WebhookService],
    controllers: [WebhookController ]
})
export class WebhookModule {}
