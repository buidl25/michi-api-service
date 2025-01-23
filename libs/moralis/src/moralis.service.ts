import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Moralis from 'moralis';
import * as MICHI_HELPER_ABI from '@app/config/abi/michi-helper-abi.json';
import * as MICHI_WALLET_NFT_ABI from '@app/config/abi/michi-wallet-nft-abi.json';
import * as BATCH_CALLER_ABI from '@app/config/abi/batch-caller-abi.json';
import * as PENDLE_YT_ABI from '@app/config/abi/pendle-yield-token-abi.json';
import * as PENDLE_LP_ABI from '@app/config/abi/pendle-lp-abi.json';

import {
    BATCH_CALLER_ADDRESSES,
    MANTLE_CHAIN_ID,
    MANTLE_SEPOLIA_CHAIN_ID,
    MICHI_HELPER_ADDRESSES,
    MICHI_WALLET_NFTS_ADDRESSES,
} from '@app/constants';
import {
    AllOrdersCancelledEvent,
    DepositEvent,
    MoralisWalletToken,
    NFTInfo,
    OrdersCancelledEvent,
    WalletCreatedEvent,
    WalletPurchasedEvent,
} from '@app/models';
import { exponentialBackoff } from '@app/utils';
import { EvmChain } from '@moralisweb3/common-evm-utils';
import { EvmReaderService } from '@app/evm-reader';
import { ethers } from 'ethers';
import * as ERC_20_ABI from '@app/config/abi/erc20-abi.json';

const PENDLE_LP_NAME = 'Pendle Market';
const PENDLE_LP_SYMBOL = 'PENDLE-LPT';

@Injectable()
export class MoralisService implements OnModuleInit {
    private readonly logger = new Logger(MoralisService.name);

    constructor(private readonly evmReader: EvmReaderService) {}

    async onModuleInit() {
        await Moralis.start({ apiKey: process.env.MORALIS_API_KEY });
    }

    async getWalletNFTs(chain: string, address: string): Promise<NFTInfo[]> {
        if (chain != MANTLE_CHAIN_ID && chain != MANTLE_SEPOLIA_CHAIN_ID) {
            let allResults = [];
            let cursor = null;

            do {
                const response = await exponentialBackoff(async () => {
                    return Moralis.EvmApi.nft.getWalletNFTs({
                        address: address,
                        chain: chain,
                        tokenAddresses: [MICHI_WALLET_NFTS_ADDRESSES[chain]],
                    });
                }, this.logger);
                const data = response.toJSON();
                allResults = allResults.concat(data.result);
                cursor = data.cursor;
            } while (cursor != null);

            return allResults;
        } else {
            const contractAddress = MICHI_WALLET_NFTS_ADDRESSES[chain];
            const provider = this.evmReader.providers.get(chain);

            const walletContract = new ethers.Contract(contractAddress, MICHI_WALLET_NFT_ABI, provider);

            try {
                const currentIndex = await walletContract.getCurrentIndex();
                const ownerPromises = [];
                for (let tokenId = 0; tokenId < currentIndex; tokenId++) {
                    ownerPromises.push(walletContract.ownerOf(tokenId));
                }

                const owners = await Promise.all(ownerPromises);

                const nftInfos: NFTInfo[] = [];
                for (let tokenId = 0; tokenId < currentIndex; tokenId++) {
                    nftInfos.push({
                        owner_of: owners[tokenId].toLowerCase(),
                        token_id: tokenId.toString(),
                    });
                }

                const ownedNFTs = nftInfos.filter(nft => nft.owner_of === address.toLowerCase());
                return ownedNFTs;
            } catch (error) {
                this.logger.error(`Failed to fetch NFTs for user: ${error.message}`, error.stack);
                throw error;
            }
        }
    }


    async getTokenDetails(chain: string, tokenAddress: string, address?: string): Promise<MoralisWalletToken> {
        const tokenContract = new ethers.Contract(tokenAddress, ERC_20_ABI, this.evmReader.providers.get(chain));

        const [name, symbol, decimals] = await Promise.all([
            tokenContract.name(),
            tokenContract.symbol(),
            tokenContract.decimals(),
        ]);

        let balance = '0';
        if (address) {
            balance = (await tokenContract.balanceOf(address)).toString();
        }

        return new MoralisWalletToken(
            tokenAddress,
            name,
            symbol,
            decimals.toString(),
            balance
        );
    }

    async getWalletTokenBalances(chain: string, address: string, tokenAddresses: string[]): Promise<MoralisWalletToken[]> {
        if (tokenAddresses.length == 0) return [];
        if (chain != MANTLE_CHAIN_ID && chain != MANTLE_SEPOLIA_CHAIN_ID) {
            const response = await exponentialBackoff(async () => {
                return Moralis.EvmApi.token.getWalletTokenBalances({
                    address: address,
                    chain: chain,
                    tokenAddresses: tokenAddresses,
                });
            }, this.logger);
            return response.toJSON();
        }else {
            const tokenDataPromises = tokenAddresses.map(tokenAddress => this.getTokenDetails(chain, tokenAddress, address));
            const tokens = await Promise.all(tokenDataPromises);
            return tokens;
        }
    }

    async getTokenMetadata(chain: string, addresses: string[]) {
        if(chain != MANTLE_CHAIN_ID && chain != MANTLE_SEPOLIA_CHAIN_ID) {
            const response = await exponentialBackoff(async () => {
                return Moralis.EvmApi.token.getTokenMetadata({
                    chain: chain,
                    addresses: addresses,
                });
            }, this.logger);
            const responseJson = response.toJSON();
            const metadataPromises = responseJson.map(data => this.fillTokenMetadata(chain, data));
            const metadata = await Promise.all(metadataPromises);

            return metadata;
        } else {
            const tokenDataPromises = addresses.map(tokenAddress => this.fillTokenMetadataRpc(chain, tokenAddress));
            const tokens = await Promise.all(tokenDataPromises);
            return tokens;
        }
    }

    private async fillTokenMetadata(chain: string, data: any) {
        if (!data.name) {
            const fetchedData: any = await this.evmReader.getErc20Metadata(data.address, chain);
            return {
                ...data,
                ...fetchedData,
            };
        } else if (data.name === PENDLE_LP_NAME || data.symbol === PENDLE_LP_SYMBOL) {
            const pendleLpTokens = await this.readPendleLPTokens(chain, data.address);
            const fetchedLpData: any = await this.evmReader.getErc20Metadata(pendleLpTokens._YT, chain);
            return {
                ...data,
                name: this.buildLPTokenName(fetchedLpData.name),
                symbol: this.buildLPTokenSymbol(fetchedLpData.symbol),
            };
        } else {
            return data;
        }
    }

    private async fillTokenMetadataRpc(chain: string, address: any) {
        const tokenContract = new ethers.Contract(address, ERC_20_ABI, this.evmReader.providers.get(chain));

        // eslint-disable-next-line prefer-const
        let [name, symbol, decimals] = await Promise.all([
            tokenContract.name(),
            tokenContract.symbol(),
            tokenContract.decimals(),
        ]);

        if (name === PENDLE_LP_NAME || symbol === PENDLE_LP_SYMBOL) {
            const pendleLpTokens = await this.readPendleLPTokens(chain, address);
            const fetchedLpData: any = await this.evmReader.getErc20Metadata(pendleLpTokens[2], chain); // Index 2 gives YT
            name = this.buildLPTokenName(fetchedLpData.name);
            symbol = this.buildLPTokenSymbol(fetchedLpData.symbol);
        }

        return {
            address: address.toLowerCase(),
            chain_id: chain,
            name,
            symbol,
            decimals: decimals.toString(),
        };
    }

    private buildLPTokenName(fetchedName: string) {
        const name = fetchedName + ' ' + PENDLE_LP_SYMBOL;
        if (name.startsWith('YT')) {
            return name.substring(2).trim();
        }
        return name;
    }

    private buildLPTokenSymbol(fetchedSymbol: string) {
        const symbol = fetchedSymbol + '-' + PENDLE_LP_SYMBOL;
        if (symbol.startsWith('YT-')) {
            return symbol.substring(3).trim();
        }
        return symbol;
    }

    private async readPendleLPTokens(chain: string, contractAddress: string) {
        if (chain != MANTLE_CHAIN_ID && chain != MANTLE_SEPOLIA_CHAIN_ID) {
            const response = await exponentialBackoff(async () => {
                return Moralis.EvmApi.utils.runContractFunction({
                    chain: chain,
                    address: contractAddress,
                    functionName: 'readTokens',
                    abi: PENDLE_LP_ABI,
                    params: {},
                });
            }, this.logger);
            return JSON.parse(JSON.stringify(response.raw));
        }else {
            const contract = new ethers.Contract(contractAddress, PENDLE_LP_ABI, this.evmReader.providers.get(chain));
            const tokens = await contract.readTokens();
            return JSON.parse(JSON.stringify(tokens));
        }
    }

    async getApprovedTokens(chain: string): Promise<string[]> {
        if (chain != MANTLE_CHAIN_ID && chain != MANTLE_SEPOLIA_CHAIN_ID) {
            const response = await exponentialBackoff(async () => {
                return Moralis.EvmApi.utils.runContractFunction({
                    chain: chain,
                    address: MICHI_HELPER_ADDRESSES[chain],
                    functionName: 'getApprovedTokens',
                    abi: MICHI_HELPER_ABI,
                });
            }, this.logger);
            return JSON.parse(JSON.stringify(response.raw));
        } else {
            const helperContract = new ethers.Contract(MICHI_HELPER_ADDRESSES[chain], MICHI_HELPER_ABI, this.evmReader.providers.get(chain));
            const approvedTokens = await helperContract.getApprovedTokens();
            return JSON.parse(JSON.stringify(approvedTokens));
        }
    }

    async getSyToken(chain: string, tokenContractAddress: string) {
        if (chain != MANTLE_CHAIN_ID && chain != MANTLE_SEPOLIA_CHAIN_ID) {
            const response = await exponentialBackoff(async () => {
                return Moralis.EvmApi.utils.runContractFunction({
                    chain: chain,
                    address: tokenContractAddress,
                    functionName: 'SY',
                    abi: PENDLE_YT_ABI,
                    params: {},
                });
            }, this.logger);
            return JSON.parse(JSON.stringify(response.raw));
        }else {
            const contract = new ethers.Contract(tokenContractAddress, PENDLE_YT_ABI, this.evmReader.providers.get(chain));
            const syToken = await contract.SY();
            return JSON.parse(JSON.stringify(syToken));
        }
    }

    // This function is not used, should we remove it?
    async getMichiNFTOwner(chain: string, index: number) {
        const response = await exponentialBackoff(async () => {
            return Moralis.EvmApi.utils.runContractFunction({
                chain: chain,
                address: MICHI_WALLET_NFTS_ADDRESSES[chain],
                functionName: 'ownerOf',
                abi: MICHI_WALLET_NFT_ABI,
                params: { tokenId: index.toString() },
            });
        }, this.logger);
        return JSON.parse(JSON.stringify(response.raw));
    }

    async getMichiNFTOwnerBatched(chain: string, startIndex: number, endIndex: number) {
        if (chain != MANTLE_CHAIN_ID && chain != MANTLE_SEPOLIA_CHAIN_ID) {
            const response = await exponentialBackoff(async () => {
                return Moralis.EvmApi.utils.runContractFunction({
                    chain: chain,
                    address: BATCH_CALLER_ADDRESSES[chain],
                    functionName: 'checkERC721Owners',
                    abi: BATCH_CALLER_ABI,
                    params: {
                        nftAddress: MICHI_WALLET_NFTS_ADDRESSES[chain],
                        startTokenId: startIndex.toString(),
                        endTokenId: endIndex.toString(),
                    },
                });
            }, this.logger);
            return JSON.parse(JSON.stringify(response.raw));
        } else {
            const batchCallerContract = new ethers.Contract(BATCH_CALLER_ADDRESSES[chain], BATCH_CALLER_ABI, this.evmReader.providers.get(chain));
            const owners = await batchCallerContract.checkERC721Owners(MICHI_WALLET_NFTS_ADDRESSES[chain], startIndex, endIndex);
            const formattedOwners = owners.map(owner => owner.toString());
            return JSON.parse(JSON.stringify(formattedOwners));
        }
    }

    async getERC20TokenBalancesBatched(chain: string, tokenAddress: string, walletAddresses: string[]) {
        if (chain != MANTLE_CHAIN_ID && chain != MANTLE_SEPOLIA_CHAIN_ID) {
            const response = await exponentialBackoff(async () => {
                return Moralis.EvmApi.utils.runContractFunction({
                    chain: chain,
                    address: BATCH_CALLER_ADDRESSES[chain],
                    functionName: 'checkERC20Balances',
                    abi: BATCH_CALLER_ABI,
                    params: {
                        tokenAddress: tokenAddress,
                        walletAddresses: walletAddresses,
                    },
                });
            }, this.logger);
            return JSON.parse(JSON.stringify(response.raw));
        } else {
            const batchCallerContract = new ethers.Contract(BATCH_CALLER_ADDRESSES[chain], BATCH_CALLER_ABI, this.evmReader.providers.get(chain));
            const balances = await batchCallerContract.checkERC20Balances(tokenAddress, walletAddresses);
            const formattedBalances = balances.map(balance => balance.toString());
            return JSON.parse(JSON.stringify(formattedBalances));
        }
    }

    async getMichiCurrentIndex(chain: string) {
        if (chain != MANTLE_CHAIN_ID && chain != MANTLE_SEPOLIA_CHAIN_ID) {
            const response = await exponentialBackoff(async () => {
                return Moralis.EvmApi.utils.runContractFunction({
                    chain: chain,
                    address: MICHI_WALLET_NFTS_ADDRESSES[chain],
                    functionName: 'getCurrentIndex',
                    abi: MICHI_WALLET_NFT_ABI,
                });
            }, this.logger);
            return JSON.parse(JSON.stringify(response.raw));
        } else {
            const walletContract = new ethers.Contract(MICHI_WALLET_NFTS_ADDRESSES[chain], MICHI_WALLET_NFT_ABI, this.evmReader.providers.get(chain));
            const currentIndex = await walletContract.getCurrentIndex();
            return JSON.parse(JSON.stringify(currentIndex.toString()));
        }
    }

    async getBlockByDate(provider, date: Date): Promise<number> {
        const currentBlock = await provider.getBlock('latest');
        const targetTimestamp = date.getTime();

        let lowerBlock = 0;
        let upperBlock = currentBlock.number;

        while (lowerBlock <= upperBlock) {
            const middleBlock = Math.floor((lowerBlock + upperBlock) / 2);
            const block = await provider.getBlock(middleBlock);
            const blockTimestamp = block.timestamp * 1000;

            if (blockTimestamp === targetTimestamp) {
                return middleBlock;
            } else if (blockTimestamp < targetTimestamp) {
                lowerBlock = middleBlock + 1;
            } else {
                upperBlock = middleBlock - 1;
            }
        }

        return lowerBlock;
    }

    async getWalletERC20Transfers(chain: string, walletAddress: string, fromDate: Date, toDate: Date, cursor = null) {
        if (chain != MANTLE_CHAIN_ID && chain != MANTLE_SEPOLIA_CHAIN_ID) {
            const response = await exponentialBackoff(async () => {
                return Moralis.EvmApi.token.getWalletTokenTransfers({
                    chain: chain,
                    address: walletAddress,
                    fromDate: fromDate,
                    toDate: toDate,
                    order: 'DESC',
                    cursor: cursor,
                });
            }, this.logger);
            return JSON.parse(JSON.stringify(response.raw));
        } else {
            const provider = this.evmReader.providers.get(chain);
            const fromBlock = await this.getBlockByDate(provider, fromDate);
            const toBlock = await this.getBlockByDate(provider, toDate);

            return await exponentialBackoff(async () => {
                return await provider.getLogs({
                    address: walletAddress,
                    fromBlock: fromBlock,
                    toBlock: toBlock,
                });
            }, this.logger);
        }
    }

    async getWalletErc20TransfersRpc(chain: string, walletAddress: string, fromDate: Date, toDate: Date, cursor = null) {
        // TODO
    }

    async getTransaction(chain: string, transactionHash: string) {
        if (chain != MANTLE_CHAIN_ID && chain != MANTLE_SEPOLIA_CHAIN_ID) {
            const response = await Moralis.EvmApi.transaction.getTransaction({
                chain: chain,
                transactionHash: transactionHash,
            });
            if (response == null) throw new Error('Couldn\'t find tx.');
            return JSON.parse(JSON.stringify(response.raw));
        } else {
            const provider = this.evmReader.providers.get(chain);
            const tx = await provider.getTransaction(transactionHash);
            if (!tx) throw new Error('Couldn\'t find tx.');
            return JSON.parse(JSON.stringify(tx));
        }
    }

    parseWalletCreatedData(data): WalletCreatedEvent[] {
        return Moralis.Streams.parsedLogs<WalletCreatedEvent>(data);
    }

    parseDepositData(data): DepositEvent[] {
        return Moralis.Streams.parsedLogs<DepositEvent>(data);
    }

    parseWalletPurchasedData(data): WalletPurchasedEvent[] {
        return Moralis.Streams.parsedLogs<WalletPurchasedEvent>(data);
    }

    parseOrdersCancelledEvents(data): OrdersCancelledEvent[] {
        return Moralis.Streams.parsedLogs<OrdersCancelledEvent>(data);
    }

    parseAllOrdersCancelledEvent(data): AllOrdersCancelledEvent[] {
        return Moralis.Streams.parsedLogs<AllOrdersCancelledEvent>(data);
    }

    async createStream(chainId: string, event: string, topic: string, abi: any, isLocal = false) {
        const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/v1/webhooks/moralis/${event.toLowerCase()}`;
        this.logger.log(`Creating stream. ChainId: ${chainId}, event: ${event}, topic: ${topic}, webhookUrl: ${webhookUrl}.`);
        const tagName = process.env.ENV == 'gamma' ? `${chainId}_gamma_${event}` : `${chainId}_${event}`;
        const tag = !isLocal ? tagName : `${chainId}_local_${event}`;
        const options = {
            chains: [EvmChain.create(chainId)],
            description: `Monitor the michi helper contract on chain ${chainId} for ${event} events in ${process.env.ENV}.`,
            tag: tag,
            abi: abi,
            includeContractLogs: true,
            topic0: [topic],
            webhookUrl: webhookUrl,
        };

        const stream = await Moralis.Streams.add(options);
        const { id } = stream.toJSON();
        this.logger.log(`Created stream. Id: ${id}`);
        return id;
    }

    async deleteStream(id: string) {
        this.logger.log(`Deleting stream. Id: ${id}`);
        await Moralis.Streams.delete({ id });
    }

    async listStreams() {
        const streams = await Moralis.Streams.getAll({ limit: 100 });
        return streams.result;
    }

    async listStreamAddresses(id: string) {
        return await Moralis.Streams.getAddresses({ id, limit: 100 });
    }

    async removeAddressFromStream(id: string, address: string) {
        return await Moralis.Streams.deleteAddress({ id, address });
    }

    async addAddressToStream(id: string, address: string) {
        await Moralis.Streams.addAddress({ id, address });
    }
}