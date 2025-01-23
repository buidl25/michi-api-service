import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/db';
import { ApprovedTokenSchedulerService } from './jobs/approved-token-scheduler.service';
import { MoralisModule } from '@app/moralis';
import { ScheduleModule } from '@nestjs/schedule';
import { MoralisStreamSyncSchedulerService } from './jobs/moralis-stream-sync-scheduler.service';
import { MichiPointsProcessingSchedulerService } from './jobs/michi-points-processing-scheduler.service';
import { CommonModule } from '@app/common';
import { PointsBackfillerService } from './points-backfiller.service';
import { S3Module } from '@app/s3';
import { ThirdPartyPointsModule } from '@app/3pp';
import { ThirdPartyPointsProcessingSchedulerService } from './jobs/third-party-points-processing-scheduler.service';
import { MichiPointsSnapshotSchedulerService } from './jobs/michi-points-snapshot-scheduler.service';
import { OrderStalenessSchedulerService } from './jobs/order-staleness-scheduler.service';
import { EventsListenerService } from './listeners/events-listener';
import { EventHandlerModule } from '@app/event-handler';
import { MichiStakingPointsService } from './jobs/michi-staking-points.service';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        PrismaModule,
        MoralisModule,
        CommonModule,
        S3Module,
        ThirdPartyPointsModule,
        EventHandlerModule
    ],
    providers: [
        ApprovedTokenSchedulerService,
        MoralisStreamSyncSchedulerService,
        MichiPointsProcessingSchedulerService,
        MichiStakingPointsService,
        PointsBackfillerService,
        ThirdPartyPointsProcessingSchedulerService,
        MichiPointsSnapshotSchedulerService,
        OrderStalenessSchedulerService,
        EventsListenerService,
    ]
})
export class AppModule {}
