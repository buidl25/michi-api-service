import { Token, WalletToken } from '.prisma/client';
import { CHAIN_POINT_MULTIPLIER_CUTOFFS } from '@app/constants';
import Decimal from 'decimal.js';

export function calculateTotalPointsForTokens(
    chainId: string,
    walletTokens: WalletToken[],
    approvedTokens: Token[],
    time: Date
): Decimal {
    let pointsToAdd = new Decimal(0);
    for (const walletToken of walletTokens) {
        const token = approvedTokens.find(token => token.address === walletToken.token_address);
        pointsToAdd = pointsToAdd.plus(calculatePointsForToken(chainId, token, walletToken.balance, time));
    }
    return pointsToAdd;
}

function calculatePointsForToken(chainId: string, token: Token, amount: Decimal, time: Date): Decimal {
    // Sanity check
    if (amount.lessThan(new Decimal(0))) {
        amount = new Decimal(0);
    }

    return amount
        .dividedBy(new Decimal(`1e${token.decimals}`))
        .times(getBasePointsPerHour(token))
        .times(getPointsMultiplier(chainId, time));
}

function getBasePointsPerHour(token: Token): number {
    const name = token.name.toLowerCase();
    if (isYtOrPt(name) && token.name.includes('ETH')) { // YT/PT ETH
        return 2000;
    } else if (isYtOrPt(name) && name.includes('usde')) { // YT/PT USDe/sUSDe
        return 1;
    } else if (isYtOrPt(name) && name.includes('ena')) { // YT/PT ENA
        return 1.5;
    } else if (isLPT(name) && token.name.includes('ETH')) { // LPT ETH
        return 4000;
    } else if (isLPT(name) && name.includes('usde')) { // LPT USDe/sUSDe
        return 2;
    } else if (isLPT(name) && name.includes('ena')) { // LPT ENA
        return 3;
    } else if (token.name.includes('ETH')) { // Non-pendle ETH
        return 2000;
    } else if (name.includes('usde')) { // Non-pendle USDe
        return 1;
    } else if (name.includes('ena')) { // Non-pendle ENA
        return 1.5;
    } else {
        return 0;
    }
}

function isYtOrPt(name: string) {
    return name.includes('yt') || name.includes('pt');
}

function isLPT(name: string) {
    return name.includes('pendle-lpt');
}

function getPointsMultiplier(chainId: string, time: Date): number {
    for (const cutoff of CHAIN_POINT_MULTIPLIER_CUTOFFS[chainId]) {
        if (time < cutoff.endDate) {
            return cutoff.multiplier; 
        }
    }
    return 1;
}

export function roundToNearestHour(date: Date): Date {
    const copiedDate = new Date(date.getTime());
    if (copiedDate.getMinutes() >= 30) {
        copiedDate.setHours(copiedDate.getHours() + 1);
    }
    copiedDate.setMinutes(0);
    copiedDate.setSeconds(0);
    copiedDate.setMilliseconds(0);
    return copiedDate;
}