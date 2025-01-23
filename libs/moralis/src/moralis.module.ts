import { Module } from '@nestjs/common';
import { MoralisService } from './moralis.service';
import { EvmReaderModule } from '@app/evm-reader';

@Module({
    imports: [EvmReaderModule],
    providers: [MoralisService],
    exports: [MoralisService],
})

export class MoralisModule {}