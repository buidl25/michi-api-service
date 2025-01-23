import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/db';
import { PointsService } from './points.service';
import { PointsController } from './points.controller';
import { ThirdPartyPointsModule } from '@app/3pp';

@Module({
    imports: [PrismaModule, ThirdPartyPointsModule],
    providers: [PointsService],
    exports: [PointsService],
    controllers: [PointsController]
})

export class PointsModule {}