import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { PrismaModule } from '@app/db';
import { MoralisModule } from '@app/moralis';
import { TokenboundModule } from '@app/tokenbound';

@Module({
    imports: [PrismaModule, MoralisModule, TokenboundModule],
    providers: [CommonService],
    exports: [CommonService],
})
export class CommonModule {}
