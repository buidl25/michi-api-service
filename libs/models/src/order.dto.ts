import { OrderType } from '@prisma/client';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export enum OrderStatus {
    ACTIVE = 'ACTIVE',
    CANCELLED = 'CANCELLED',
    PROCESSING_CANCELLATION = 'PROCESSING_CANCELLATION'
}

export class CreateOrderDto {
    @IsNotEmpty()
    type: OrderType;

    @IsNotEmpty()
    @IsString()
    collection: string;

    @IsNotEmpty()
    @IsString()
    currency: string;

    @IsNotEmpty()
    @IsString()
    participant: string;

    @IsNotEmpty()
    @IsString()
    chainId: string;

    @IsNotEmpty()
    @IsNumber()
    tokenId: number;

    @IsNotEmpty()
    @IsString()
    amount: string;

    @IsNotEmpty()
    @IsString()
    expiry: string;
    
    @IsNotEmpty()
    @IsNumber()
    nonce: number;

    @IsNotEmpty()
    @IsString()
    signature: string;
}