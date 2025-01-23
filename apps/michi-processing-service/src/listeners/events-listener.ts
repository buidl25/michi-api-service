import {
    RPC_CHAIN_IDS,
    MANTLE_SEPOLIA_RPC,
    RPC_ENDPOINTS,
    MICHI_HELPER_ADDRESSES,
    MICHI_MARKETPLACE_ADDRESSES,
    MICHI_STAKING_ADDRESSES,
} from '@app/constants';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { JsonRpcProvider, ethers } from 'ethers';
import * as MICHI_HELPER_ABI from '@app/config/abi/michi-helper-abi.json';
import * as MICHI_MARKETPLACE_ABI from '@app/config/abi/michi-marketplace-abi.json';
import * as MICHI_STAKING_ABI from '@app/config/abi/michi-staking-abi.json';
import { MichiEvent } from '@app/models';
import { EventHandlerService } from '@app/event-handler';

interface ContractConfig {
    address: string;
    abi: any;
    events: string[];
}

@Injectable()
export class EventsListenerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(EventsListenerService.name);
    private providers: Map<string, ethers.JsonRpcProvider> = new Map();
    private contracts: Map<string, Map<string, ethers.Contract>> = new Map();
    private isListening: boolean = false;

    constructor(
        private eventHandler: EventHandlerService,
    ) {
        this.initClients();
    }


    initClients() {
        for (const chain of RPC_CHAIN_IDS) {
            this.logger.log(`Initializing evm listener for chain: ${chain}`);
            const provider = this.initRpc(chain);
            this.initContracts(chain, provider);
        }
    }

    initRpc(chain: string) {
        const provider = new JsonRpcProvider(`${RPC_ENDPOINTS[chain]}`);
        this.providers.set(chain, provider);

        return provider;
    }

    initContracts(chain: string, provider: JsonRpcProvider) {
        const contractConfigs: ContractConfig[] = [
            {
                address: MICHI_HELPER_ADDRESSES[chain],
                abi: MICHI_HELPER_ABI,
                events: [MichiEvent.WALLET_CREATED, MichiEvent.DEPOSIT],
            },
            {
                address: MICHI_STAKING_ADDRESSES[chain],
                abi: MICHI_STAKING_ABI,
                events: ['Stake', 'Unstake'],
            },
            // {
            //     address: MICHI_MARKETPLACE_ADDRESSES[chain],
            //     abi: MICHI_MARKETPLACE_ABI,
            //     events: [MichiEvent.WALLET_PURCHASED,  MichiEvent.ORDERS_CANCELLED, MichiEvent.ALL_ORDERS_CANCELLED],
            // },
        ];

        const contracts: Map<string, ethers.Contract> = new Map();
        for (const config of contractConfigs) {
            const contract = new ethers.Contract(config.address, config.abi, provider);
            contracts.set(config.address, contract);
        }
        this.contracts.set(chain, contracts);
    }

    async onModuleInit() {
        await this.startListening();
        console.log('Started listening for blockchain events');
    }

    async onModuleDestroy() {
        await this.stopListening();
    }

    private async startListening() {
        if (this.isListening) return;

        this.isListening = true;

        try {
            for (const chain of RPC_CHAIN_IDS) {
                for (const [address, contract] of this.contracts.get(chain)) {
                    const config = this.getContractConfig(address, chain);
                    console.log('Listening for events on contract:', address, 'on chain:', chain);
                    for (const eventName of config.events) {
                        await contract.on(eventName, (...args) => {
                            console.log('Event received:', eventName, 'with args:', args);
                            this.handleEvent(eventName, args, chain);
                        });
                    }
                }
                this.providers.get(chain).on('error', this.handleProviderError.bind(this));
            }
        } catch (error) {
            console.error('Error starting listeners:', error);
            this.isListening = false;
            await this.reconnect();
        }
    }

    private async stopListening() {
        if (!this.isListening) return;

        for (const chain of RPC_CHAIN_IDS) {
            for (const [_, contract] of this.contracts.get(chain)) {
                contract.removeAllListeners();
                this.providers[chain].removeAllListeners();
            }
        }

        this.isListening = false;
        console.log('Stopped listening for blockchain events');
    }

    private async handleEvent(eventName: string, args: any[], chain: string) {
        console.log('Event name: ', eventName);
        switch (eventName) {
            case MichiEvent.STAKE: {
                const [walletAddress, stakedAmount] = args; // Assuming these are the event arguments
                this.logger.log(`Stake event detected for ${walletAddress.toLowerCase()} on chain ${chain} with amount ${stakedAmount}`);
                return await this.eventHandler.updateStakingInfo(walletAddress.toLowerCase(), stakedAmount, chain);
            }
            case MichiEvent.UNSTAKE: {
                const [walletAddress, unstakedAmount] = args;
                this.logger.log(`Unstake event detected for ${walletAddress.toLowerCase()} on chain ${chain} with amount ${unstakedAmount}`);
                const unstakedAmountBigint = BigInt(unstakedAmount.toString());
                return  await this.eventHandler.updateStakingInfo(walletAddress.toLowerCase(), -unstakedAmountBigint, chain);
            }
            case MichiEvent.WALLET_CREATED:
                return await this.eventHandler.handleWalletCreatedEvent(args, chain);
            case MichiEvent.DEPOSIT:
                return await this.eventHandler.handleDepositEvent(args, chain);
            case MichiEvent.WALLET_PURCHASED:
                // Not needed yet
                return;
            case MichiEvent.ORDERS_CANCELLED:
                // Not needed yet
                return;
            case MichiEvent.ALL_ORDERS_CANCELLED:
                // Not needed yet
                return;
            default:
                this.logger.error(`Unhandled event type: ${eventName}`);
                return;
        }
    }

    private async handleProviderError(error: Error) {
        console.error('Provider error:', error);
        await this.reconnect();
    }

    private async reconnect() {
        console.log('Attempting to reconnect...');
        await this.stopListening();

        await new Promise(resolve => setTimeout(resolve, 5000));

        for (const chain of RPC_CHAIN_IDS) {
            const provider = this.initRpc(chain);
            this.initContracts(chain, provider);
        }


        await this.startListening();
    }

    private getContractConfig(address: string, chain: string) {
        if (MICHI_HELPER_ADDRESSES[chain].includes(address)) {
            return {
                address,
                abi: MICHI_HELPER_ABI,
                events: [MichiEvent.WALLET_CREATED, MichiEvent.DEPOSIT],
            };
        } else if (MICHI_STAKING_ADDRESSES[chain].includes(address)) {
            return {
                address,
                abi: MICHI_STAKING_ABI,
                events: [MichiEvent.STAKE, MichiEvent.UNSTAKE],
            };
        } else {
            return {
                address,
                abi: MICHI_MARKETPLACE_ABI,
                events: [MichiEvent.WALLET_PURCHASED, MichiEvent.ORDERS_CANCELLED, MichiEvent.ALL_ORDERS_CANCELLED],
            };
        }
    }
}