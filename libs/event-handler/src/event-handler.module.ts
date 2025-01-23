import { Module } from '@nestjs/common';
import { EventHandlerService } from './event-handler.service';
import { PrismaModule } from '@app/db';
import { MoralisModule } from '@app/moralis';
import { CommonModule } from '@app/common';

@Module({
    imports: [
        PrismaModule,
        MoralisModule,
        CommonModule,
    ],
    providers: [EventHandlerService],
    exports: [EventHandlerService],
})
export class EventHandlerModule {}
