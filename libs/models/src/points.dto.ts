import { ThirdPartyPlatform } from '@app/constants';
import Decimal from 'decimal.js';

export class TotalPointsResponseData {
    pointsType: string;
    totalPoints: Decimal | string;
    chainData: ChainTotalPointsData[];
}

export class ChainTotalPointsData {
    chain: string;
    chainId: string;
    totalChainPoints: Decimal;
}

export class ThirdPartyPointsResponseData {
    platform: ThirdPartyPlatform | 'Eigenlayer';
    points: string;
}

export class ThirdPartyRawPointsData {
    platform: ThirdPartyPlatform;
    points: string;
    elPoints: string;
    generatedPoints?: any[];
    staleAt?: Date;
}

export class PointsLeaderboardResponseData {
    users: PointsLeaderboardUserData[];
}

export class PointsLeaderboardUserData {
    position: number;
    address: string;
    totalPoints: Decimal | string;
    chainData: ChainPointsData[];
}

export class ChainPointsData {
    chain: string;
    chainId: string;
    points: Decimal | string;
}

export class MichiPointsResponse {
    points: Decimal | string;
    rank: number;
}