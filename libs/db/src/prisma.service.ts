import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient, WalletToken, Token, Prisma, ThirdPartyPoints, MichiWallet, AncillaryToken, User, Account, OrderType, Order } from '@prisma/client';
import {
    ThirdPartyPlatform,
    DEFAULT_BATCH_SIZE,
    INITIAL_WALLET_POINTS,
    CHAIN_NAMES,
    ONE_HOUR,
} from '@app/constants';
import { ChainTotalPointsData, ThirdPartyPointsResponseData } from '@app/models';
import Decimal from 'decimal.js';
import { convertEpochToDate } from '@app/utils';
import { CreateOrderDto, OrderStatus } from '@app/models';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
    private readonly logger = new Logger(PrismaService.name);

    async onModuleInit() {
        await this.$connect();
    }

    async getMichiWallet(chainId: string, nftIndex: number) {
        return await this.michiWallet.findFirst({
            where: {
                chain_id: chainId,
                nft_index: nftIndex
            }
        });
    }

    async getMichiWalletByAddressOnly(walletAddress: string) {
        return await this.michiWallet.findFirst({
            where: {
                wallet_address: walletAddress.toLowerCase()
            }
        });
    }

    async getTotalMichiWallets() {
        const walletsPerChain = await this.michiWallet.groupBy({
            by: ['chain_id'],
            _count: {
                id: true,
            },
        });

        const totalWalletsCount = walletsPerChain.reduce((total, chain) => total + chain._count.id, 0);

        return {
            totalWallets: totalWalletsCount,
            chainData: walletsPerChain.map(chain => ({
                chain: CHAIN_NAMES[chain.chain_id],
                chainId: chain.chain_id,
                totalWallets: chain._count.id,
            })),
        };
    }

    async getMichiWallets(chainId: string, ownerAddress: string): Promise<MichiWallet[]> {
        return await this.michiWallet.findMany({
            where: {
                chain_id: chainId.toLowerCase(),
                owner_address: ownerAddress.toLowerCase()
            }
        });
    }

    async setMichiWallets(wallets: Prisma.MichiWalletUncheckedCreateInput[]) {
        if (wallets.length === 0 ) {
            return;
        }

        const uniqueUsers = Array.from(new Set(wallets.map(wallet => ({
            chain_id: wallet.chain_id.toLowerCase(),
            address: wallet.owner_address.toLowerCase()
        }))));

        await this.ensureUsersExist(uniqueUsers);
        await this.upsertMichiWallets(wallets);
    }

    private async ensureUsersExist(users: any[]) {
        // Prisma does not support bulk upsert, so must use raw sql
        /* eslint-disable */
        await this.$executeRaw`
            INSERT INTO users (chain_id, address, michi_points)
            VALUES ${Prisma.join(users.map(user =>
                Prisma.sql`(
                    ${user.chain_id.toLowerCase()}, 
                    ${user.address}, 
                    0
                )`)
            )}
            ON CONFLICT (chain_id, address) DO NOTHING
        `;
        /* eslint-enable */
    }

    private async upsertMichiWallets(wallets: Prisma.MichiWalletUncheckedCreateInput[]) {
        // Prisma does not support bulk upsert, so must use raw sql
        /* eslint-disable */
        await this.$executeRaw`
            INSERT INTO michi_wallets (
                chain_id, nft_index, wallet_address, owner_address, stale_at
            )
            VALUES ${Prisma.join(wallets.map(wallet =>
                Prisma.sql`(
                    ${wallet.chain_id.toLowerCase()}, 
                    ${wallet.nft_index}, 
                    ${wallet.wallet_address.toLowerCase()}, 
                    ${wallet.owner_address.toLowerCase()}, 
                    ${wallet.stale_at}
                )`)
            )}
            ON CONFLICT (chain_id, wallet_address) 
            DO UPDATE SET
                owner_address = EXCLUDED.owner_address,
                stale_at = EXCLUDED.stale_at
        `;
        /* eslint-enable */
    }

    async getWalletsByIndex(chainId: string, startIndex = 0, batchSize = DEFAULT_BATCH_SIZE) {
        const wallets = await this.michiWallet.findMany({
            where: {
                chain_id: chainId,
                nft_index: {
                    gte: startIndex
                }
            },
            take: batchSize,
            orderBy: {
                nft_index: 'asc'
            }
        });

        const lastIndex = wallets.length === 0 ? -1 : wallets[wallets.length - 1].nft_index;
        return { wallets, lastIndex };
    }

    async getAllUsersMichiPoints(skip = 0, batchSize = DEFAULT_BATCH_SIZE) {
        return await this.user.findMany({
            skip,
            take: batchSize,
            select: {
                address: true,
                michi_points: true,
            },
        });
    }

    async getMichiPointsAndRank(address: string) {
        const result = await this.$queryRaw`
            SELECT address, michi_points, rank
            FROM (
                SELECT address, michi_points, RANK() OVER (ORDER BY michi_points DESC) as rank
                FROM (
                    SELECT address, SUM(michi_points) as michi_points
                    FROM users
                    GROUP BY address
                ) subquery
            ) ranked
            WHERE address = ${address}
        `;

        return result[0] || null;
    }

    async getMichiPoints(address: string) {
        return await this.user.findMany({
            where: {
                address: address.toLowerCase()
            }
        });
    }

    async getTotalMichiPoints(): Promise<ChainTotalPointsData[]> {
        const totalsPerChain = await this.user.groupBy({
            by: ['chain_id'],
            _sum: {
                michi_points: true,
            }
        });

        return totalsPerChain.map(chain => ({
            chain: CHAIN_NAMES[chain.chain_id],
            chainId: chain.chain_id,
            totalChainPoints: chain._sum.michi_points
        }));
    }

    async getMichiPointsLeaderboard(limit: number, offset: number) {
        return await this.user.groupBy({
            by: ['address'],
            _sum: {
                michi_points: true,
            },
            orderBy: {
                _sum: {
                    michi_points: 'desc'
                }
            },
            skip: offset,
            take: limit
        });
    }

    async getUsersBulk(addresses: string[]) {
        return await this.user.findMany({
            where: {
                address: {
                    in: addresses
                }
            }
        });
    }

    async getTotalThirdPartyPoints(): Promise<ThirdPartyPointsResponseData[]> {
        const pointsByPlatform = await this.thirdPartyPoints.groupBy({
            by: ['platform'],
            _sum: {
                points: true,
                el_points: true,
            },
        });

        let elPointsTotal = new Decimal(0);
        pointsByPlatform.forEach(item => {
            elPointsTotal = elPointsTotal.plus(item._sum.el_points ?? new Decimal(0));
        });

        return [
            ...pointsByPlatform.map((item) => ({
                platform: item.platform as ThirdPartyPlatform,
                points: item._sum.points.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString()
            })),
            {
                platform: 'Eigenlayer',
                points: elPointsTotal.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString()
            }
        ];
    }

    async getThirdPartyPoints(address: string): Promise<ThirdPartyPoints[]> {
        return await this.thirdPartyPoints.findMany({
            where: {
                address: address.toLowerCase(),
                platform: {
                    in: Object.values(ThirdPartyPlatform)
                },
            },
        });
    }

    async getThirdPartyPointsBulk(addresses: string[]): Promise<ThirdPartyPoints[]> {
        return await this.thirdPartyPoints.findMany({
            where: {
                address: {
                    in: addresses
                }
            },
        });
    }

    async setThirdPartyPoints(address: string, platform: ThirdPartyPlatform, points: string, elPoints: string) {
        return await this.thirdPartyPoints.upsert({
            where: {
                address_platform: {
                    address: address.toLowerCase(),
                    platform: platform,
                },
            },
            update: {
                points: points,
                el_points: elPoints,
                stale_at: new Date(new Date().getTime() + ONE_HOUR),
            },
            create: {
                address: address.toLowerCase(),
                platform: platform,
                points: points,
                el_points: elPoints,
                stale_at: new Date(new Date().getTime() + ONE_HOUR),
            },
        });
    }

    async setThirdPartyPointsBulk(pointTotals: Prisma.ThirdPartyPointsUncheckedCreateInput[]) {
        if (pointTotals.length == 0) return;
        // Prisma does not support bulk upsert, so must use raw sql
        /* eslint-disable */
        await this.$executeRaw`
            INSERT INTO third_party_points (
                address, platform, points, el_points, stale_at
            )
            VALUES ${Prisma.join(pointTotals.map(point =>
                Prisma.sql`(
                    ${point.address.toLowerCase()}, 
                    ${point.platform}, 
                    ${point.points}::numeric, 
                    ${point.el_points}::numeric, 
                    ${point.stale_at}
                )`)
            )}
            ON CONFLICT (address, platform) 
            DO UPDATE SET
                points = EXCLUDED.points,
                el_points = EXCLUDED.el_points,
                stale_at = EXCLUDED.stale_at
        `;
        /* eslint-enable */
    }

    async getApprovedTokens(chainId: string): Promise<Token[]> {
        return await this.token.findMany({
            where: {
                chain_id: chainId,
            }
        });
    }

    async getTotalTokensData() {
        return await this.$queryRaw`
            SELECT 
                t.name AS token_name,
                t.address,
                a.chain_id,
            ROUND(CAST(SUM(a.balance) / POWER(10, t.decimals) AS numeric), 2) AS total_balance
            FROM wallet_tokens a
            JOIN tokens t ON a.token_address = t.address
            GROUP BY t.name, a.chain_id, t.address, t.decimals;
        `;
    }

    async setApprovedTokens(approvedTokenData: Prisma.TokenUncheckedCreateInput[]) {
        for (const tokenData of approvedTokenData) {
            await this.token.upsert({
                where: {
                    address_chain_id: {
                        address: tokenData.address,
                        chain_id: tokenData.chain_id,
                    }
                },
                update: {
                    name: tokenData.name,
                    symbol: tokenData.symbol,
                    decimals: tokenData.decimals,
                },
                create: {
                    ...tokenData,
                },
            });
        }
    }

    async getAncillaryTokens(chainId: string): Promise<AncillaryToken[]> {
        return await this.ancillaryToken.findMany({
            where: {
                chain_id: chainId,
            }
        });
    }

    async setAncillaryTokens(ancillaryTokenData: Prisma.AncillaryTokenUncheckedCreateInput[]) {
        for (const tokenData of ancillaryTokenData) {
            await this.ancillaryToken.upsert({
                where: {
                    address_chain_id: {
                        address: tokenData.address,
                        chain_id: tokenData.chain_id,
                    }
                },
                update: {
                    name: tokenData.name,
                    symbol: tokenData.symbol,
                    decimals: tokenData.decimals,
                },
                create: {
                    ...tokenData,
                },
            });
        }
    }

    async getApprovedTokenAddresses(chainId: string): Promise<string[]> {
        const res = await this.token.findMany({
            where: {
                chain_id: chainId.toLowerCase(),
            },
            select: {
                address: true,
            },
        });
        return res.map(row => row.address);
    }

    async getWalletTokenBalances(chainId: string, walletAddress: string): Promise<WalletToken[]> {
        return await this.walletToken.findMany({
            where: {
                chain_id: chainId.toLowerCase(),
                wallet_address: walletAddress.toLowerCase()
            }
        });
    }

    async getWalletTokenBalancesBatched(chainId: string, walletAddresses: string[]): Promise<WalletToken[]> {
        return await this.walletToken.findMany({
            where: {
                chain_id: chainId.toLowerCase(),
                wallet_address: {
                    in: walletAddresses
                }
            }
        });
    }

    async getWalletTokenBalancesBatchedWithExclusionList(chainId: string, walletAddresses: string[], exclusions: string[]): Promise<WalletToken[]> {
        return await this.walletToken.findMany({
            where: {
                chain_id: chainId.toLowerCase(),
                wallet_address: {
                    in: walletAddresses
                },
                token_address: {
                    notIn: exclusions
                }
            }
        });
    }

    async getWalletTokenBalance(chainId: string, walletAddress: string, tokenAddress: string): Promise<WalletToken> {
        return await this.walletToken.findFirst({
            where: {
                chain_id: chainId.toLowerCase(),
                wallet_address: walletAddress.toLowerCase(),
                token_address: tokenAddress.toLowerCase()
            }
        });
    }

    async setWalletTokenBalances(tokenBalanceData: Prisma.WalletTokenUncheckedCreateInput[]) {
        if (tokenBalanceData.length === 0 ) {
            return;
        }
        // Prisma does not support bulk upsert, so must use raw sql
        /* eslint-disable */
        await this.$executeRaw`
            INSERT INTO wallet_tokens (
                chain_id, wallet_address, token_address, balance, eligible_balance, stale_at, has_accrued_interest
            )
            VALUES ${Prisma.join(tokenBalanceData.map(data =>
                Prisma.sql`(
                    ${data.chain_id.toLowerCase()}, 
                    ${data.wallet_address.toLowerCase()}, 
                    ${data.token_address.toLowerCase()}, 
                    ${data.balance}::numeric, 
                    ${data.eligible_balance}::numeric, 
                    ${data.stale_at},
                    ${data.has_accrued_interest}
                )`)
            )}
            ON CONFLICT (chain_id, wallet_address, token_address) 
            DO UPDATE SET
                balance = EXCLUDED.balance,
                eligible_balance = EXCLUDED.eligible_balance,
                stale_at = EXCLUDED.stale_at,
                has_accrued_interest = wallet_tokens.has_accrued_interest OR EXCLUDED.has_accrued_interest
        `;
        /* eslint-enable */
    }

    async getWalletTokensWithAccruedInterest(chainId: string, walletAddress: string): Promise<WalletToken[]> {
        return await this.walletToken.findMany({
            where: {
                chain_id: chainId.toLowerCase(),
                wallet_address: walletAddress.toLowerCase(),
                has_accrued_interest: true
            }
        });
    }

    async setUserPoints(userPointsData: Prisma.UserUncheckedCreateInput[]) {
        if (userPointsData.length === 0 ) {
            return;
        }

        const addresses = userPointsData.map(data => data.address.toLowerCase());
        await this.createAccountsIfNotExist(addresses);
        const allAccounts = await this.account.findMany({
            where: {
                address: { in: addresses },
            },
        });
        const accountMap = new Map(allAccounts.map(account => [account.address, account.id]));

        const userUpsertData = userPointsData.map(data => ({
            chain_id: data.chain_id.toLowerCase(),
            address: data.address.toLowerCase(),
            michi_points: data.michi_points,
            account_id: accountMap.get(data.address.toLowerCase()),
        }));

        // Prisma does not support bulk upsert, so must use raw sql
        /* eslint-disable */
        await this.$executeRaw`
            INSERT INTO users (
                chain_id, address, michi_points, account_id
            )
            VALUES ${Prisma.join(userUpsertData.map(data => 
                Prisma.sql`(
                    ${data.chain_id}, 
                    ${data.address}, 
                    ${data.michi_points}::numeric,
                    ${data.account_id}
                )`)
            )}
            ON CONFLICT (chain_id, address) 
            DO UPDATE SET
                michi_points = users.michi_points + EXCLUDED.michi_points - ${INITIAL_WALLET_POINTS}
        `;
        /* eslint-enable */
    }

    private async createAccountsIfNotExist(addresses: string[]) {
        const existingAccounts = await this.account.findMany({
            where: {
                address: { in: addresses },
            },
        });
        const existingAddresses = new Set(existingAccounts.map(account => account.address));
        const newAccountsData = addresses
            .filter(address => !existingAddresses.has(address))
            .map(address => ({ address }));
        if (newAccountsData.length > 0) {
            await this.account.createMany({
                data: newAccountsData,
            });
        }
    }

    async getProcessedMoralisEvent(id: string) {
        return await this.processedMoralisEvent.findFirst({
            where: {
                id: id
            }
        });
    }

    async setProcessedMoralisEvent(id: string) {
        await this.processedMoralisEvent.create({
            data: { id: id }
        });
    }

    async getCurrentNftIndex(chainId: string) {
        const result = await this.michiWallet.aggregate({
            _max: {
                nft_index: true,
            },
            where: {
                chain_id: chainId,
            },
        });
        
        return result._max.nft_index !== null ? result._max.nft_index : -1;
    }

    async getJobHistoryLastProcessingTime(chainId: string, jobName: string): Promise<Date> {
        const result = await this.jobHistory.findUnique({
            where: {
                job_name_chain_id: {
                    job_name: jobName,
                    chain_id: chainId
                }
            }
        });
        return result ? result.last_processing_time : null;
    }

    async getLastPointsProcessingTime(chainId: string): Promise<Date> {
        const result = await this.lastPointsProcessingTime.findUnique({
            where: {
                chain_id: chainId
            }
        });
        return result ? result.last_processing_time : null;
    }

    async setLastPointsProcessingTime(chainId: string, date: Date) {
        await this.lastPointsProcessingTime.upsert({
            where: {
                chain_id: chainId
            },
            update: {
                last_processing_time: date
            },
            create: {
                chain_id: chainId,
                last_processing_time: date
            },
        });
    }

    async getAccount(address: string) {
        return await this.account.findUnique({
            where: { address }
        });
    }

    async getAccountById(id: number) {
        return await this.account.findUnique({
            where: { id }
        });
    }

    async getAccountByAffiliateId(affiliateId: string) {
        return await this.account.findFirst({
            where: {
                affiliate_id: affiliateId
            }
        });
    }

    async getReferredAccounts(referrerId: number) {
        return await this.account.findMany({
            where: {
                referrer_id: referrerId,
            },
        });
    }

    async getOrCreateAccount(address: string) {
        let account = await this.account.findUnique({
            where: {
                address: address,
            },
        });

        if (!account) {
            account = await this.account.create({
                data: {
                    address: address
                },
            });
        }

        return account;
    }

    async createAccountWithReferrer(address: string, referrer: Account) {
        return await this.account.create({
            data: {
                address,
                referrer_id: referrer.id
            },
        });
    }

    async updateAccountAffiliateId(accountId: number, affiliateId: string) {
        await this.account.update({
            where: {
                id: accountId,
            },
            data: {
                affiliate_id: affiliateId,
            },
        });
    }

    async createOrder(createOrderDto: CreateOrderDto) {
        await this.ensureUsersExist([{
            address: createOrderDto.participant.toLowerCase(),
            chain_id: createOrderDto.chainId
        }]);

        const order = await this.order.create({
            data: {
                ...createOrderDto,
                collection: createOrderDto.collection.toLowerCase(),
                currency: createOrderDto.currency.toLowerCase(),
                participant: createOrderDto.participant.toLowerCase(),
                expiry: convertEpochToDate(createOrderDto.expiry),
                status: OrderStatus.ACTIVE.toString()
            }
        });

        return await this.order.findUnique({
            where: { id: order.id },
            include: { wallet: true }
        });
    }

    async deleteOrder(where: Prisma.OrderWhereInput) {
        await this.order.deleteMany({ where });
    }

    async updateOrderStaleness(id: number, isStale: boolean) {
        await this.order.update({
            where: {
                id
            },
            data: { isStale }
        });
    }

    async updateOrdersStaleness(ids: number[], isStale: boolean) {
        await this.order.updateMany({
            where: {
                id: {in: ids}
            },
            data: { isStale }
        });
    }

    async cancelOrders(where: Prisma.OrderWhereInput) {
        return await this.order.updateMany({
            where,
            data: { status: OrderStatus.CANCELLED.toString() }
        });
    }

    async markOrdersAsPendingCancellation(where: Prisma.OrderWhereInput) {
        return await this.order.updateMany({
            where,
            data: { 
                status: OrderStatus.PROCESSING_CANCELLATION.toString(),
                pending_cancellation_date: new Date()
            }
        });
    }

    async getNonStaleOrders(
        limit: number,
        offset: number,
        where: Prisma.OrderWhereInput,
        ownerAddress?: string,
        descending=true
    ) {
        return this.order.findMany({ 
            where: {
                ...where,
                expiry: {
                    gt: new Date()
                },
                isStale: false,
                ...(ownerAddress && {
                    wallet: {
                        owner_address: ownerAddress
                    }
                })
            },
            include: {
                wallet: {
                    select: { wallet_address: true, owner_address: true }
                },
            },
            orderBy: {
                date: descending ? 'desc' : 'asc',
            },
            skip: offset,
            take: limit
        });
    }

    async getOrdersByCriteria(where: Prisma.OrderWhereInput) {
        return this.order.findMany({ 
            where: {
                ...where,
                expiry: {
                    gt: new Date()
                },
            }
        });
    }

    async createSale(sale: Prisma.SaleUncheckedCreateInput) {
        await this.ensureUsersExist([
            {
                address: sale.buyerAddress.toLowerCase(),
                chain_id: sale.chainId
            },
            {
                address: sale.sellerAddress.toLowerCase(),
                chain_id: sale.chainId
            }
        ]);

        await this.sale.create({
            data: {
                ...sale,
                collection: sale.collection.toLowerCase(),
                currency: sale.currency.toLowerCase(),
                buyerAddress: sale.buyerAddress.toLowerCase(),
                sellerAddress: sale.sellerAddress.toLowerCase(),
                date: new Date()
            }
        });
    }

    async getSalesByCriteria(where: Prisma.SaleWhereInput) {
        return this.sale.findMany({ where });
    }

    async getUserNonce(chain: string, address: string) {
        const user = await this.user.findUnique({
            where: { 
                chain_id_address: {
                    chain_id: chain,
                    address: address.toLowerCase() 
                }
            }
        });
        return user ? user.nonce : 0;
    }

    async setUserNonce(chain: string, address: string, nonce: number) {
        await this.user.update({
            where: {
                chain_id_address: {
                    chain_id: chain,
                    address: address.toLowerCase()
                }
            },
            data: { nonce }
        });
    }

    async checkPendingOrderCancellations() {
        const oneHourAgo = new Date(Date.now() - 60 * 30 * 1000);

        await this.order.updateMany({
            where: {
                status: OrderStatus.PROCESSING_CANCELLATION.toString(),
                pending_cancellation_date: {
                    lt: oneHourAgo
                }
            },
            data: {
                status: OrderStatus.ACTIVE.toString(),
                pending_cancellation_date: null
            }
        });
    }

    async getListingsForWallets(michiWallets: Prisma.MichiWalletUncheckedCreateInput[], chainId: string) {
        return await this.order.findMany({
            where: {
                tokenId: { in: michiWallets.map(wallet => wallet.nft_index) },
                chainId,
                type: OrderType.LISTING,
                participant: michiWallets[0].owner_address,
                status: OrderStatus.ACTIVE.toString(),
                expiry: { gt: new Date() }
            },
            select: {
                tokenId: true,
                amount: true,
                currency: true
            },
            orderBy: {
                amount: 'asc'
            },
            distinct: ['tokenId']
        });
    }

    async getActiveOrdersBatchedByMinTokenId(chainId: string, minTokenId: number, batchSize: number) {
        return this.order.findMany({
            where: {
                chainId,
                status: { not: OrderStatus.CANCELLED },
                tokenId: { gte: minTokenId },
                expiry: { gt: new Date() }
            },
            orderBy: [
                { tokenId: 'asc' },
                { participant: 'asc' },
                { currency: 'asc' }
            ],
            take: batchSize,
        });
    }
}