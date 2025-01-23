import { Controller, Get, Query } from '@nestjs/common';
import { ClaimService ,ClaimDataResponse} from './claim.service';


@Controller({ version: ['1'], path: 'claim' })
export class ClaimController {
    constructor(private readonly claimService: ClaimService) {
    }

  @Get('etherfi')
    async getClaimData(
    @Query('address') address: string,
    @Query('allocation') allocation: string,
    @Query('chainId') chainId: number,
    ): Promise<ClaimDataResponse> {
        return this.claimService.getClaimData(address, allocation, chainId);
    }
}
