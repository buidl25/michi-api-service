import { PrismaService } from '@app/db';
import { AddressWithPoints, AffiliateStats } from '@app/models/user.dto';
import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';

export const INVITE_LINK_BASE = `${process.env.FRONTEND_URL}/invite`;

@Injectable()
export class UserService {

    constructor(
        private readonly prisma: PrismaService,
    ) {}

    async getAffiliateStats(address: string): Promise<AffiliateStats> {
        const account = await this.prisma.getAccount(address);
        if (!account) {
            throw new BadRequestException('User not found');
        }

        const referredAccounts = await this.prisma.getReferredAccounts(account.id);
        const referredAccountsUserRows = await this.prisma.getUsersBulk(referredAccounts.map(account => account.address));
        const referredAccountsMap: { [key: string]: AddressWithPoints } = {};
        for (const account of referredAccounts) {
            referredAccountsMap[account.address] = {
                address: account.address,
                points: new Prisma.Decimal(0)
            };
        }
        for (const userRow of referredAccountsUserRows) {
            referredAccountsMap[userRow.address].points = referredAccountsMap[userRow.address].points.plus(userRow.michi_points);
        }

        const referredAccountsWithPoints = Object.values(referredAccountsMap);
        const totalReferralPoints = referredAccountsWithPoints.reduce((total, account) => {
            return total.plus(account.points.mul(0.1));
        }, new Prisma.Decimal(0));

        return {
            referralPoints: totalReferralPoints.toFixed(0),
            numReferrals: referredAccounts.length,
            topReferredUsers: referredAccountsWithPoints.sort((a, b) => b.points.minus(a.points).toNumber()),
        };
    }

    async generateAffiliateLink(address: string) {
        const account = await this.prisma.getOrCreateAccount(address);

        if (account.affiliate_id != null) {
            return { inviteLink: `${INVITE_LINK_BASE}/${account.affiliate_id}` };
        } else {
            const newAffiliatedId = address.substring(2, 6) + nanoid(6);
            await this.prisma.updateAccountAffiliateId(account.id, newAffiliatedId);
            return { inviteLink: `${INVITE_LINK_BASE}/${newAffiliatedId}`};
        }
    }

    async createAccountWithReferrer(address: string, affiliateId: string) {
        const account = await this.prisma.getAccount(address);
        if (account) {
            let referrerAddress = null;
            if (account.referrer_id) {
                referrerAddress = (await this.prisma.getAccountById(account.referrer_id))?.address;
            }
            throw new HttpException({
                message: 'User already exists',
                referredBy: referrerAddress
            }, HttpStatus.CONFLICT);
        }

        const referrer = await this.prisma.getAccountByAffiliateId(affiliateId);
        if (!referrer) {
            throw new BadRequestException({message: 'AffiliateId does not exist.'});
        }

        await this.prisma.createAccountWithReferrer(address, referrer);

        return 'User referred sucessfully';
    }

    async getUserNonce(chain: string, address: string) {
        return await this.prisma.getUserNonce(chain, address);
    }
}