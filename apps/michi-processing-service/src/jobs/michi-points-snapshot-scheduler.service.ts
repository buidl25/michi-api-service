import { MICHI_POINTS_BUCKET_NAME } from '@app/constants';
import { PrismaService } from '@app/db';
import { S3Service } from '@app/s3';
import { getDateAsKeyString } from '@app/utils';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

const BATCH_SIZE = 5000;

@Injectable()
export class MichiPointsSnapshotSchedulerService {
    private readonly logger = new Logger(MichiPointsSnapshotSchedulerService.name);

    constructor(
        private prisma: PrismaService, 
        private s3Service: S3Service
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async snashotUserMichiPoints() {
        try {
            this.logger.log(`Running ${MichiPointsSnapshotSchedulerService.name}`);
            
            const dateKey = getDateAsKeyString();
            let users = [];
            let skip = 0;

            do {
                users = await this.prisma.getAllUsersMichiPoints(skip, BATCH_SIZE);
                if (users.length == 0) break;

                const userDataJson = JSON.stringify(users);
                const key = `${process.env.ENV}/${dateKey}/${skip / BATCH_SIZE + 1}.json`;
    
                // Upload the data to S3
                await this.s3Service.uploadFile(MICHI_POINTS_BUCKET_NAME, key, userDataJson, 'application/json');
        
                // Move to the next chunk
                skip += BATCH_SIZE;
            } while (users.length == BATCH_SIZE);
        
            this.logger.log(`Finished running ${MichiPointsSnapshotSchedulerService.name}`);
        } catch (error) {
            this.logger.error(`Error running ${MichiPointsSnapshotSchedulerService.name}`, error);
        }
    }
}