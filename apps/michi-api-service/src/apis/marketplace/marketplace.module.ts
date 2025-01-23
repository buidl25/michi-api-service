import { Module } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceController } from './marketplace.controller';
import { PrismaModule } from '@app/db';
import { PointsModule } from '../points/points.module';
import { TokensModule } from '../tokens/tokens.module';
import { MoralisModule } from '@app/moralis';

@Module({
    imports: [PrismaModule, PointsModule, TokensModule, MoralisModule],
    controllers: [MarketplaceController],
    providers: [MarketplaceService],
    exports: [MarketplaceService]
})
export class MarketplaceModule {}
