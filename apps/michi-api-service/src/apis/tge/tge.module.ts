import { Module } from '@nestjs/common';
import { TgeService } from './tge.service';
import { TgeController } from './tge.controller';
import { NFTModule } from '../nft/nft.module';
import { PointsModule } from '../points/points.module';
import { PrismaModule } from '@app/db';

@Module({
    controllers: [TgeController],
    imports: [NFTModule, PointsModule, PrismaModule],
    providers: [TgeService],
})
export class TgeModule {}
