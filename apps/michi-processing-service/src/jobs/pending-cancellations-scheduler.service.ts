import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@app/db';

@Injectable()
export class PendingCancellationsSchedulerService {
    private readonly logger = new Logger(PendingCancellationsSchedulerService.name);
    private isRunning = false;
    
    constructor(
        private prisma: PrismaService
    ) {}

    @Cron(CronExpression.EVERY_30_MINUTES)
    async checkPendingCancellations() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.logger.log(`Running ${PendingCancellationsSchedulerService.name}`);
        try  {
            await this.prisma.checkPendingOrderCancellations();
        } catch (error) {
            this.logger.error(`Failed to run ${PendingCancellationsSchedulerService.name}: ${error}`);
        }
        this.logger.log(`Finished running ${PendingCancellationsSchedulerService.name}`);
        this.isRunning = false;
    }
}