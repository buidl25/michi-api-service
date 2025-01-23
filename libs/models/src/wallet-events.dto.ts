import { BigNumber } from '@moralisweb3/core';

export enum MichiEvent {
    WALLET_CREATED = 'WalletCreated',
    DEPOSIT = 'Deposit',
    WALLET_PURCHASED = 'WalletPurchased',
    ORDERS_CANCELLED = 'OrdersCancelled',
    ALL_ORDERS_CANCELLED = 'AllOrdersCancelled',
    STAKE = 'Stake',
    UNSTAKE = 'Unstake'
}

export interface WalletCreatedEvent {
    sender: string,
    walletAddress: string,
    nftContract: string,
    tokenId: BigNumber
}

export interface DepositEvent {
    sender: string,
    walletAddress: string,
    token: string,
    amountAfterFees: BigNumber,
    feeTaken: BigNumber
}

export interface WalletPurchasedEvent {
    seller: string,
    buyer: string,
    collection: string,
    currency: string,
    tokenId: BigNumber,
    amount: BigNumber,
    nonce: BigNumber
}

export interface OrdersCancelledEvent {
    user: string,
    orderNonces: BigNumber[]
}

export interface AllOrdersCancelledEvent {
    user: string,
    minNonce: BigNumber
}