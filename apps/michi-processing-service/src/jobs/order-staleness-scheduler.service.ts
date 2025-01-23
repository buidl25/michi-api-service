import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@app/db';
import { LIVE_CHAIN_IDS } from '@app/constants';
import { Order } from '@prisma/client';

const BATCH_SIZE = 10000;

@Injectable()
export class OrderStalenessSchedulerService {
    private readonly logger = new Logger(OrderStalenessSchedulerService.name);
    private isRunning = false;
    
    constructor(
        private prisma: PrismaService
    ) {}

    @Cron(CronExpression.EVERY_HOUR)
    async checkPendingCancellations() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.logger.log(`Running ${OrderStalenessSchedulerService.name}`);
        try  {
            await Promise.all(LIVE_CHAIN_IDS.map(chainId => this.validateOrderStaleness(chainId)));
        } catch (error) {
            this.logger.error(`Failed to run ${OrderStalenessSchedulerService.name}: ${error}`);
        }
        this.logger.log(`Finished running ${OrderStalenessSchedulerService.name}`);
        this.isRunning = false;
    }

    async validateOrderStaleness(chainId: string) {
        let hasMore = true;
        let minTokenId = -1;
    
        while (hasMore) {
            const orders = await this.prisma.getActiveOrdersBatchedByMinTokenId(chainId, minTokenId, BATCH_SIZE);
    
            if (orders.length < BATCH_SIZE) {
                hasMore = false;
            }
    
            const [groupedOrders, len] = this.groupOrders(orders);
            const i = 1;
            for (const group of groupedOrders.values()) {
                minTokenId = group[0].tokenId;
                if (i == len && hasMore) {
                    break;
                }
                await this.updateStaleness(group);
            }
        }
    }
    
    private groupOrders(orders: Order[]): [Map<string, Order[]>, number] {
        const groupMap = new Map<string, Order[]>();
        let len = 0;
    
        for (const order of orders) {
            const key = `${order.type}-${order.tokenId}-${order.participant}${order.type === 'BID' ? `-${order.currency}` : ''}`;
            if (!groupMap.has(key)) {
                groupMap.set(key, []);
                len += 1;
            }
            groupMap.get(key)!.push(order);
        }
    
        return [groupMap, len];
    }
    
    private async updateStaleness(group: Order[]) {
        const sortedGroup = group.sort((a, b) => 
            a.type === 'LISTING' 
                ? a.amount.minus(b.amount).toNumber()
                : b.amount.minus(a.amount).toNumber()
        );

        sortedGroup.forEach(async (order, index) => {
            if (order.isStale !== (index !== 0)) {
                this.logger.log(`Updating order with incorrect staleness: ${JSON.stringify(order)}`);
                await this.prisma.updateOrderStaleness(order.id, index !== 0);
            }
        });
    }
}