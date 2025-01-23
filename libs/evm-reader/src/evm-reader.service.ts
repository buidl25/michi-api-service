import { LIVE_CHAIN_IDS, RPC_ENDPOINTS } from '@app/constants';
import { Injectable, Logger } from '@nestjs/common';
import { JsonRpcProvider, ethers } from 'ethers';
import * as ERC_20_ABI from '@app/config/abi/erc20-abi.json';

@Injectable()
export class EvmReaderService {
    private readonly logger = new Logger(EvmReaderService.name);

    providers: Map<string, ethers.JsonRpcProvider> = new Map();

    constructor() {
        this.initClients();
    }

    initClients() {
        for (const chain of LIVE_CHAIN_IDS) {
            this.logger.log(`Initializing evm reader for chain: ${chain}`);
            const provider = new JsonRpcProvider(RPC_ENDPOINTS[chain]);
            this.providers.set(chain, provider);
        }
    }

    async getErc20Metadata(address: string, chain: string) {
        this.logger.log(`Fetching erc20 metadata from contract: ${address} on chain: ${chain}`);
        try {
            const contract = new ethers.Contract(address, ERC_20_ABI, this.providers.get(chain));
            const [name, symbol, decimals] = await Promise.all([
                contract.name(),
                contract.symbol(),
                contract.decimals()
            ]);
            return {
                name: name,
                symbol: symbol,
                decimals: decimals,
            };
        } catch (error) {
            this.logger.error(`fetch metadata tx failed: ${error.message}`);
            throw error;
        }
    }
}