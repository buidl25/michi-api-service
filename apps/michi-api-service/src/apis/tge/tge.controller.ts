import { Controller, Get, Param } from '@nestjs/common';
import { TgeService } from './tge.service';

@Controller({version: ['1'], path: 'tge'})
export class TgeController {
    constructor(private readonly tgeService: TgeService) {}

    @Get('supply')
    async getSupply() {
        return 121000000;
    }

    @Get('merkleroot')
    async getMerkleRoot() {
        return this.tgeService.getRoot();
    }

    @Get('claim/:address')
    async getClaim(@Param('address') address: string) {
        return await this.tgeService.getClaim(address);
    }
}
