import { Controller, Get, Logger, Param, Query } from '@nestjs/common';
import { PointsService } from './points.service';
import { MichiPointsResponse, ThirdPartyPointsResponseData, ThirdPartyRawPointsData } from '@app/models';
import BigNumber from 'bignumber.js';
import { EIGENLAYER } from '@app/constants';

@Controller({version: ['1'], path: 'points'})
export class PointsController {
    private readonly logger = new Logger(PointsController.name);

    constructor(private readonly pointsService: PointsService) {}

    @Get('total')
    getThirdPartyPointsTotals() {
        return this.pointsService.getTotalPoints();
    }

    @Get('total/michi')
    getTotalMichiPoints() {
        return this.pointsService.getTotalMichiPoints();
    }

    @Get('leaderboard/michi')
    getMichiPointsLeaderboard(@Query('limit') limit = 100, @Query('offset') offset = 0) {
        return this.pointsService.getMichiPointsLeaderboard(
            parseInt(limit.toString()), 
            parseInt(offset.toString())
        );
    }

    @Get(':address')
    async getPointsByAddress(@Param('address') address: string): Promise<ThirdPartyPointsResponseData[]> {
        return await this.pointsService.getThirdPartyPoints(address.toLowerCase());
    }

    @Get(':address/michi')
    async getMichiPointsByAddress(@Param('address') address: string): Promise<MichiPointsResponse> {
        return this.pointsService.getMichiPoints(address.toLowerCase());
    }
}