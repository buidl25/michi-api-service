import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/db';
import { TokensService } from './tokens.service';
import { TokensController } from './tokens.controller';
import { MoralisModule } from '@app/moralis';
import { TokenboundModule } from '@app/tokenbound';
import { HttpModule } from '@nestjs/axios';
import { EvmReaderModule } from '@app/evm-reader';

@Module({
    imports: [PrismaModule, MoralisModule, TokenboundModule,HttpModule, EvmReaderModule],
    providers: [TokensService],
    exports: [TokensService],
    controllers: [TokensController]
})

export class TokensModule {}