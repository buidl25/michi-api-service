import { Module } from '@nestjs/common';
import { EvmReaderService } from './evm-reader.service';

@Module({
    providers: [EvmReaderService],
    exports: [EvmReaderService],
})
export class EvmReaderModule {}
