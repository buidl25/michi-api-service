import { OrderType } from '@prisma/client';

export class CancelOrdersDto {
    chainId: string;
    isCancelAll: boolean;
    hash: string;
}

export class GetOrderDto {
    type?: OrderType;
    participant?: string;
    chainId?: string;
    tokenId?: number;
    collection?: string;
    nonce?: number;
    ownerAddress?: string;
    status?: string;
    limit?: number;
    offset?: number;
}

export class GetOrderOnWalletDto {
    type: OrderType;
}

export class GetSaleDto {
    buyer?: string;
    seller?: string;
    chainId?: string;
    tokenId?: number;
    collection?: string;
    points?: string[];
    startDate?: number;
    endDate?: number;
}