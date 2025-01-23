import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/db';
import { MoralisModule } from '@app/moralis';
import { NFTService } from './nft.service';
import { NFTController } from './nft.controller';
import { TokenboundModule } from '@app/tokenbound';
import { PointsModule } from '../points/points.module';

@Module({    
    imports: [
        PrismaModule,
        MoralisModule,
        TokenboundModule,
        PointsModule
    ],
    providers: [NFTService],
    exports: [NFTService],
    controllers: [NFTController]
})
    
export class NFTModule {}
