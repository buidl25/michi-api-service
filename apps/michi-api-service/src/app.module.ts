import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PointsModule } from './apis/points/points.module';
import { NFTModule } from './apis/nft/nft.module';
import { TokensModule } from './apis/tokens/tokens.module';
import { WebhookModule } from './apis/webhook/webhook.module';
import { UserModule } from './apis/user/user.module';
import { MarketplaceModule } from './apis/marketplace/marketplace.module';
import { TgeModule } from './apis/tge/tge.module';
import { ClaimModule } from './apis/claim/claim.module';

@Module({
    imports: [
        PointsModule, 
        NFTModule,
        TokensModule,
        UserModule,
        WebhookModule,
        MarketplaceModule,
        TgeModule,
        ClaimModule
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
