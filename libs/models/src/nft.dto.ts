export class MichiWalletResponseData {
    chainId: string;
    walletAddress: string;
    nftIndex: string;
    price: string;
    currency: string;
}

export class MoralisNFT {
    amount: string;
    token_id: string;
    token_address: string;
    contract_type: string;
    owner_of: string;
    last_metadata_sync: string;
    last_token_uri_sync: string;
    metadata: string;
    block_number: string;
    block_number_minted: string;
    name: string;
    symbol: string;
    token_hash: string;
    token_uri: string;
    minter_address: string;
    verified_collection: boolean;
    possible_spam: boolean;
    collection_logo: string;
    collection_banner_image: string;
}

export type NFTInfo = {
    owner_of: string;
    token_id: string;
};