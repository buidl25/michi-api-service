import { Injectable, Logger } from '@nestjs/common';
import { JsonRpcProvider, Wallet } from 'ethers';
import { TokenboundClient } from '@tokenbound/sdk';
import {
    LIVE_CHAIN_IDS,
    MANTLE_CHAIN_ID,
    MANTLE_SEPOLIA_CHAIN_ID,
    MICHI_WALLET_NFTS_ADDRESSES,
    RPC_ENDPOINTS,
} from '@app/constants';
import { mantle, mantleSepoliaTestnet } from 'viem/chains';

@Injectable()
export class TokenboundService {
    private readonly logger = new Logger(TokenboundService.name);
    private tokenBoundClients: Map<string, TokenboundClient> = new Map();

    constructor() {
        this.initClients();
    }

    initClients() {
        for (const chain of LIVE_CHAIN_IDS) {
            this.logger.log(`Initializing tokenbound client for chain: ${chain}`);
            const provider = new JsonRpcProvider(RPC_ENDPOINTS[chain]);
            const wallet = new Wallet(process.env.WALLET_PRIVATE_KEY, provider);
            let chainId;
            if (chain === MANTLE_CHAIN_ID) {
                this.tokenBoundClients.set(chain, new TokenboundClient({
                    signer: wallet,
                    chain: {...mantle, fees: undefined},
                }));
            } else if (chain === MANTLE_SEPOLIA_CHAIN_ID) {
                this.tokenBoundClients.set(chain, new TokenboundClient({
                    signer: wallet,
                    chain: {...mantleSepoliaTestnet, fees: undefined},
                }));
            } else {
                this.tokenBoundClients.set(chain, new TokenboundClient({
                    signer: wallet,
                    chainId: parseInt(chain),
                }));
            }

        }
    }

    getAccount(chainId: string, tokenId: string) {
        return this.tokenBoundClients.get(chainId).getAccount({
            tokenContract: MICHI_WALLET_NFTS_ADDRESSES[chainId],
            tokenId: tokenId,
        });
    }

    async isAccountDeployed(chainId: string, accountAddress: string) {
        return await this.tokenBoundClients.get(chainId).checkAccountDeployment({
            accountAddress: accountAddress as `0x${string}`,
        });
    }

}