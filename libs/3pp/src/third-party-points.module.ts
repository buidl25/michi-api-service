import { Module } from '@nestjs/common';
import { ThirdPartyPointsService } from './third-party-points.service';

@Module({
    providers: [ThirdPartyPointsService],
    exports: [ThirdPartyPointsService],
})
export class ThirdPartyPointsModule {}
