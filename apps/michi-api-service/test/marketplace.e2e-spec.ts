import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@app/db';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { OrderType } from '@prisma/client';
import { CreateOrderDto, OrderStatus } from '@app/models';
import { AppModule } from '../src/app.module';
import { MoralisService } from '@app/moralis';
import { SEPOLIA_CHAIN_ID } from '@app/constants';
import { TokenboundService } from '@app/tokenbound';
import { ThirdPartyPointsService } from '@app/3pp';
import Decimal from 'decimal.js';

const COLLECTION = 'collection';
const USER1 = 'user1';
const USER2 = 'user2';
const USDC = 'usdc';
const WETH = 'weth';
const SIGNATURE = 'signature';
const THIRTY_MIN = 30 * 60 * 1000;
const WALLET1 = 'wallet1';
const WALLET2 = 'wallet2';
const WALLET3 = 'wallet3';
const TOKEN1 = 'token1';

describe('Marketplace (e2e)', () => {
    let app: INestApplication;
    let prismaService: PrismaService;
    let moralisService: MoralisService;

    async function setupDbData() {
        await prismaService.user.createMany({
            data: [
                { address: USER1, chain_id: SEPOLIA_CHAIN_ID, michi_points: 0 },
                { address: USER2, chain_id: SEPOLIA_CHAIN_ID, michi_points: 0 },
            ]
        });
        await prismaService.token.createMany({
            data: [
                { chain_id: SEPOLIA_CHAIN_ID, address: TOKEN1 }
            ]
        });
        await prismaService.michiWallet.createMany({
            data: [
                { chain_id: SEPOLIA_CHAIN_ID, nft_index: 1, wallet_address: WALLET1, owner_address: USER1, stale_at: new Date() },
                { chain_id: SEPOLIA_CHAIN_ID, nft_index: 2, wallet_address: WALLET2, owner_address: USER1, stale_at: new Date() },
                { chain_id: SEPOLIA_CHAIN_ID, nft_index: 3, wallet_address: WALLET3, owner_address: USER2, stale_at: new Date() },
            ],
        });
        await prismaService.walletToken.createMany({
            data: [
                { chain_id: SEPOLIA_CHAIN_ID, wallet_address: WALLET2, token_address: TOKEN1, balance: new Decimal(1), 
                    eligible_balance: new Decimal(1), stale_at: new Date(Date.now() + THIRTY_MIN) }
            ]
        });
    }

    async function cleanDb() {
        await prismaService.$executeRaw`TRUNCATE TABLE "wallet_tokens" CASCADE`;
        await prismaService.$executeRaw`TRUNCATE TABLE "tokens" CASCADE`;
        await prismaService.$executeRaw`TRUNCATE TABLE "michi_wallets" CASCADE`;
        await prismaService.$executeRaw`TRUNCATE TABLE "orders" CASCADE`;
        await prismaService.$executeRaw`TRUNCATE TABLE "users" CASCADE`;
    }

    async function validateOrderExists(createOrderDto: CreateOrderDto, isStale=false) {
        const createdOrder = await prismaService.order.findFirst({
            where: {
                chainId: createOrderDto.chainId,
                participant: createOrderDto.participant,
                nonce: createOrderDto.nonce,
                isStale: isStale
            },
        });
      
        expect(createdOrder).toBeTruthy();
    }

    async function updateOrderStatus(createOrderDto: CreateOrderDto, status: OrderStatus) {
        await prismaService.order.updateMany({
            where: {
                chainId: createOrderDto.chainId,
                participant: createOrderDto.participant,
                nonce: createOrderDto.nonce
            },
            data: { status }
        });
    }

    async function setOrderExpired(createOrderDto: CreateOrderDto) {
        await prismaService.order.updateMany({
            where: {
                chainId: createOrderDto.chainId,
                participant: createOrderDto.participant,
                nonce: createOrderDto.nonce
            },
            data: {
                expiry: new Date(Date.now() - 60)
            }
        });
    }

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(MoralisService)
            .useValue({
                getTransaction: jest.fn().mockResolvedValue({}),
                getWalletTokenBalances: jest.fn()
            })
            .overrideProvider(TokenboundService)
            .useValue({
                isAccountDeployed: jest.fn().mockResolvedValue(true)
            })
            .overrideProvider(ThirdPartyPointsService)
            .useValue({
                fetchPlatformDataFromUrl: jest.fn().mockResolvedValue({points: '0', elPoints: '0'})
            })
            .compile();
      
        app = moduleFixture.createNestApplication();
        await app.init();
      
        prismaService = moduleFixture.get<PrismaService>(PrismaService);
        moralisService = moduleFixture.get<MoralisService>(MoralisService);
    });

    afterAll(async () => {
        await cleanDb();
        await prismaService.$disconnect();
        await app.close();
    });

    function resetMocks() {
        jest.spyOn(moralisService, 'getWalletTokenBalances').mockResolvedValue([]);
    }

    beforeEach(async () => {
        resetMocks();
        await cleanDb();
        await setupDbData();
    });

    it('create order (happy)', async () => {
        const createOrderDto: CreateOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 1, amount: '10', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };
      
        const response = await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(201);
      
        expect(response.text).toBe('Order created successfully');
        await validateOrderExists(createOrderDto);
    });

    it('create listing of lower value', async () => {
        const createOrderDto: CreateOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 1, amount: '10', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };
      
        await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(201);
      
        await validateOrderExists(createOrderDto);

        const createOrderDtoAgain = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 1, amount: '9', nonce: 2, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };
      
        await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDtoAgain)
            .expect(201);
      
        await validateOrderExists(createOrderDtoAgain);
        await validateOrderExists(createOrderDto, true);
    });

    it('create listing of higher value than cancelled listing', async () => {
        let createOrderDto: CreateOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 1, amount: '10', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };
      
        await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(201);
        await validateOrderExists(createOrderDto);
        await updateOrderStatus(createOrderDto, OrderStatus.CANCELLED);

        createOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 1, amount: '11', nonce: 2, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };
      
        await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(201);
        await validateOrderExists(createOrderDto);
    });

    it('create listing of higher value than expired listing', async () => {
        let createOrderDto: CreateOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 1, amount: '10', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };
      
        await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(201);
        await validateOrderExists(createOrderDto);
        await setOrderExpired(createOrderDto);
        await validateOrderExists(createOrderDto);

        createOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 1, amount: '11', nonce: 2, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };
      
        await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(201);
        await validateOrderExists(createOrderDto);
    });

    it('create bid of higher value', async () => {
        const createOrderDto: CreateOrderDto = {
            type: OrderType.BID, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 3, amount: '10', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };
      
        await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(201);
      
        await validateOrderExists(createOrderDto);

        const createOrderDtoAgain = {
            type: OrderType.BID, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 3, amount: '11', nonce: 2, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };
      
        await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDtoAgain)
            .expect(201);
      
        await validateOrderExists(createOrderDtoAgain);
        await validateOrderExists(createOrderDto, true);
    });

    it('fail if duplicate nonce', async () => {
        let createOrderDto: CreateOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 1, amount: '10', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };
      
        await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(201);

        createOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 1, amount: '9', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };
      
        await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(409);
    });

    it('fail if bidding on owned wallet', async () => {
        const createOrderDto: CreateOrderDto = {
            type: OrderType.BID, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 1, amount: '10', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };
      
        const response = await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(420);
      
        expect(response.body.message).toBe('Cannot bid on a wallet you already own.');
    });

    it('fail create order if wallet DNE', async () => {
        const createOrderDto: CreateOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 0, amount: '10', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };

        const response = await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(404);

        expect(response.body.message).toBe('Wallet does not exist.');
    });

    it('fail create order if do not own wallet', async () => {
        const createOrderDto: CreateOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 3, amount: '10', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };

        const response = await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(421);

        expect(response.body.message).toBe('You do not own this wallet.');
    });

    it('fail create order if tokens in wallet', async () => {
        jest.spyOn(moralisService, 'getWalletTokenBalances').mockResolvedValue([
            { token_address: TOKEN1, name: '', symbol: '', decimals: 1, balance: '1', possible_spam: false }
        ]);

        const createOrderDto: CreateOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 2, amount: '10', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };

        const response = await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(422);

        expect(response.body.message).toBe('Wallet contains tokens.');
    });

    it('fail create order if active listing of lower value', async () => {
        let createOrderDto: CreateOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 1, amount: '10', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };

        let response = await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(201);

        createOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 1, amount: '11', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };

        response = await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(424);

        expect(response.body.message).toBe('You have an existing listing of equal or lower value for this wallet.');
    });

    it('fail create order if processing_cancellation listing of lower value', async () => {
        let createOrderDto: CreateOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 1, amount: '10', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };

        let response = await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(201);
        await updateOrderStatus(createOrderDto, OrderStatus.PROCESSING_CANCELLATION);

        createOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 1, amount: '11', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };

        response = await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(424);

        expect(response.body.message).toBe('You have an existing listing of equal or lower value for this wallet.');
    });

    it('fail create order if existing listing of different currency', async () => {
        let createOrderDto: CreateOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 1, amount: '10', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };

        let response = await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(201);

        createOrderDto = {
            type: OrderType.LISTING, collection: COLLECTION, currency: WETH, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 1, amount: '9', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };

        response = await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(425);

        expect(response.body.message).toBe('You have an existing listing using a different currency for this wallet.');
    });

    it('fail create order if existing bid of higher value', async () => {
        let createOrderDto: CreateOrderDto = {
            type: OrderType.BID, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 3, amount: '10', nonce: 1, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };

        let response = await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(201);

        createOrderDto = {
            type: OrderType.BID, collection: COLLECTION, currency: USDC, chainId: SEPOLIA_CHAIN_ID,
            participant: USER1, tokenId: 3, amount: '9', nonce: 2, signature: SIGNATURE,
            expiry: (new Date(Date.now() + THIRTY_MIN)).getTime().toString()
        };

        response = await request(app.getHttpServer())
            .post('/marketplace/order')
            .send(createOrderDto)
            .expect(423);

        expect(response.body.message).toBe('You have an existing bid of equal or higher value for this wallet.');
    });

    it('mark specific orders as PENDING_CANCELLATION', async () => {
        // TODO
    });

    it('mark all order below nonce as PENDING_CANCELLATION', async () => {
        // TODO
    });

    it('reeive event to cancel specific orders', async () => {
        // TODO
    });

    it('reeive event to cancel all orders below nonce', async () => {
        // TODO
    });

    it('reeive wallet purchased event', async () => {
        // TODO
    });

});