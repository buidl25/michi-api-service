import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ALL_ORDERS_CANCELLED_TOPIC, DEPOSIT_TOPIC, LIVE_CHAIN_IDS, MICHI_HELPER_ADDRESSES, MICHI_MARKETPLACE_ADDRESSES, ORDERS_CANCELLED_TOPIC, SEPOLIA_CHAIN_ID, WALLET_CREATED_TOPIC, WALLET_PURCHASED_TOPIC } from '@app/constants';
import { MoralisService } from '@app/moralis';
import { MichiEvent } from '@app/models';
import * as MICHI_HELPER_ABI from '@app/config/abi/michi-helper-abi.json';
import * as MICHI_MARKETPLACE_ABI from '@app/config/abi/michi-marketplace-abi.json';

@Injectable()
export class MoralisStreamSyncSchedulerService {
    private readonly logger = new Logger(MoralisStreamSyncSchedulerService.name);
    private isRunning = false;
    
    constructor(
        private moralis: MoralisService
    ) {}

    @Cron(CronExpression.EVERY_HOUR)
    async syncMoralisStreams() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.logger.log(`Running ${MoralisStreamSyncSchedulerService.name}`);
        try {
            const moralisStreams = await this.moralis.listStreams();
            this.logStreamInfo(moralisStreams);
            const retainedStreams = this.deleteStreamsToRecreate(moralisStreams);

            for (const chainId of LIVE_CHAIN_IDS) {
                await this.syncEventStream(retainedStreams, chainId, MichiEvent.WALLET_CREATED, 
                    WALLET_CREATED_TOPIC, MICHI_HELPER_ADDRESSES[chainId], MICHI_HELPER_ABI);
                await this.syncEventStream(retainedStreams, chainId, MichiEvent.DEPOSIT, 
                    DEPOSIT_TOPIC, MICHI_HELPER_ADDRESSES[chainId], MICHI_HELPER_ABI);
                await this.syncEventStream(retainedStreams, chainId, MichiEvent.WALLET_PURCHASED, 
                    WALLET_PURCHASED_TOPIC, MICHI_MARKETPLACE_ADDRESSES[chainId], MICHI_MARKETPLACE_ABI);
                await this.syncEventStream(retainedStreams, chainId, MichiEvent.ORDERS_CANCELLED, 
                    ORDERS_CANCELLED_TOPIC, MICHI_MARKETPLACE_ADDRESSES[chainId], MICHI_MARKETPLACE_ABI);
                await this.syncEventStream(retainedStreams, chainId, MichiEvent.ALL_ORDERS_CANCELLED, 
                    ALL_ORDERS_CANCELLED_TOPIC, MICHI_MARKETPLACE_ADDRESSES[chainId], MICHI_MARKETPLACE_ABI);
            }
        } catch (error) {
            this.logger.error(`Failed to get sync moralis streams: ${error}`);
        }
        this.isRunning = false;
    }

    async syncEventStream(
        moralisStreams: any[],
        chainId: string,
        event: string,
        eventTopic: string,
        address: string,
        abi: any
    ) {
        let streamName = '';
        if (process.env.ENV == 'development') {
            this.logger.log('Running local sync stream');
            return await this.syncEventStreamLocal(chainId, event, eventTopic, address, abi);
        } else if (process.env.ENV == 'gamma') {
            streamName = `${chainId}_gamma_${event}`;
        } else {
            streamName = `${chainId}_${event}`;
        }

        const stream = moralisStreams.find(s => s.tag.includes(streamName));
        let id: string;
        if (!stream) {
            id = await this.moralis.createStream(chainId, event, eventTopic, abi);
        }
        await this.syncStreamAddresses(id || stream.id, chainId, address);
    }

    async syncEventStreamLocal(
        chainId: string,
        event: string,
        eventTopic: string,
        address: string,
        abi: any
    ) {
        if (chainId != SEPOLIA_CHAIN_ID) {
            this.logger.log('Cannot run local stream sync against prod chain');
            return;
        }

        const id = await this.moralis.createStream(chainId, event, eventTopic, abi, true);
        await this.syncStreamAddresses(id, chainId, address);
    }

    async syncStreamAddresses(streamId: string, chainId: string, address: string) {
        const streamAddresses = await this.moralis.listStreamAddresses(streamId);
        const addressList = [];

        for (const evmAddress of streamAddresses.result) {
            addressList.push(evmAddress.address.lowercase);
            if (evmAddress.address.lowercase !== address.toLowerCase()) {
                this.logger.log(`Removing address ${address} from stream ${streamId} on chain ${chainId}`);
                await this.moralis.removeAddressFromStream(streamId, address);
            }
        }

        if (!addressList.includes(address)) {
            this.logger.log(`Adding address ${address} to stream ${streamId} on chain ${chainId}`);
            await this.moralis.addAddressToStream(streamId, address);
        }
    }

    logStreamInfo(streams) {
        const streamInfos = streams.map(stream => ({
            id: stream.id,
            webhookUrl: stream.webhookUrl,
            tag: stream.tag
        }));

        this.logger.log(`Moralis Streams: ${JSON.stringify(streamInfos)}`);
    }

    deleteStreamsToRecreate(streams) {
        return streams.filter(stream => {
            const isDevStreamAndEnv = stream.webhookUrl.includes('ngrok') && process.env.ENV === 'development';
            
            if (isDevStreamAndEnv) {
                this.moralis.deleteStream(stream.id);
                return false;
            }
            
            return true;
        });
    }
}