import { Module } from '@nestjs/common';
import { TokenboundService } from './tokenbound.service';

@Module({
    providers: [TokenboundService],
    exports: [TokenboundService],
})
export class TokenboundModule {}
