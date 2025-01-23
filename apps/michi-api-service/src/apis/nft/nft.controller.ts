import { Controller, Get, Logger, Param } from '@nestjs/common';
import { NFTService } from './nft.service';

@Controller({version: ['1'], path: 'nft'})
export class NFTController {
    private readonly logger = new Logger(NFTController.name);

    constructor(private readonly nftService: NFTService) {}

    @Get('total')
    async getTotalMichiWallets() {
        return this.nftService.getTotalMichiWallets();
    }

    @Get('lookup/:address')
    async lookupWalletNFTInfo(@Param('address') address: string) {
        return this.nftService.lookupWalletNFTInfo(address);
    }

    @Get(':owner')
    async getWalletNFTs(@Param('owner') owner: string) {
        return this.nftService.getOwnedMichiWallets(owner);
    }
}