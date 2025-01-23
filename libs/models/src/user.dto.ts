import { Prisma } from '@prisma/client';

export class AddressWithPoints {
    address: string;
    points: Prisma.Decimal;
}

export class AffiliateStats {
    referralPoints: string;
    numReferrals: number;
    topReferredUsers: AddressWithPoints[];
}