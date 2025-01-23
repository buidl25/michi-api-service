export class WalletTokenResponseData {
    chainId: string;
    tokenAddress: string;
    name: string;
    symbol: string;
    balance: string;
    decimals: number;
    eligibleForInterest: boolean;
}

// Should this just be a type?
export class MoralisWalletToken {
    token_address: string;
    name: string;
    symbol: string;
    logo?: string;
    thumbnail?: string;
    decimals: number;
    balance: string;
    possible_spam?: boolean;
    verified_contract?: boolean;

    constructor(token_address: string, name: string, symbol: string, decimals: number, balance: string) {
        this.token_address = token_address;
        this.name = name;
        this.symbol = symbol;
        this.decimals = decimals;
        this.balance = balance;
    }
}