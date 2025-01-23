export const EIGENLAYER = 'Eigenlayer';

export enum ThirdPartyPlatform {
    KELPDAO = 'KelpDAO',
    ETHERFI = 'Etherfi',
    RENZO = 'Renzo',
    BEDROCK = 'Bedrock',
    SWELL = 'Swell',
    ETHENA = 'Ethena',
    POWDER = 'Powder',
    PILLS = 'Pills',
    CORN = 'Kernels',
    MELLOW = 'Mellow',
    SYMBIOTIC = 'Symbiotic',
    KARAK = 'Karak',
    AMPHOR = 'Amphor',
    ZIRCUIT = 'Zircuit'
}

export const THIRD_PARTY_PLATFORMS_API_URLS = {
    [ThirdPartyPlatform.KELPDAO]: 'https://common.staderlabs.com/km-el-points/user/{address}',
    [ThirdPartyPlatform.ETHERFI]: 'https://app.ether.fi/api/portfolio/v3/{address}',
    [ThirdPartyPlatform.RENZO]: 'https://app.renzoprotocol.com/api/points/{address}',
    [ThirdPartyPlatform.BEDROCK]: 'https://points.magic.top/eigenlayer/points/{address}',
    [ThirdPartyPlatform.SWELL]: 'https://www.restaking.city/api/points/swell?address={address}',
    [ThirdPartyPlatform.ETHENA]: 'https://app.ethena.fi/api/referral/get-referree?address={address}',
    [ThirdPartyPlatform.POWDER]: 'https://cmeth-api.mantle.xyz/points/{address}',
    [ThirdPartyPlatform.PILLS]: 'https://app.usual.money/api/points/{address}',
    [ThirdPartyPlatform.CORN]: 'https://api.usecorn.com/api/v1/kernels/balance/{address}',
    [ThirdPartyPlatform.MELLOW]: 'https://points.mellow.finance/v1/chain/1/users/{address}',
    [ThirdPartyPlatform.SYMBIOTIC]: 'https://points.mellow.finance/v1/chain/1/users/{address}',
    [ThirdPartyPlatform.KARAK]: 'https://restaking-backend.karak.network/api/getXP?wallet={address}',
    [ThirdPartyPlatform.AMPHOR]: 'https://app.amphor.io/api/userPoints?address={address}',
    [ThirdPartyPlatform.ZIRCUIT]: '',
};

const MOCK_POINT_TOKEN_ADDRESSES = {
    [ThirdPartyPlatform.KELPDAO]: '0x167d4D53c5259814CD1F4dF6B4e361c5eEDa89ee',
    [ThirdPartyPlatform.ETHENA]: '0xfe921de34570da8040a9247a9dc21cf539942402',
    [EIGENLAYER]: '0x3c6f26acacfe292232ea1751c5d7fc5641123482'
};
const REAL_POINT_TOKEN_ADDRESSES = {

};
export const POINT_TOKEN_ADDRESSES = process.env.ENV == 'prod' ? REAL_POINT_TOKEN_ADDRESSES : MOCK_POINT_TOKEN_ADDRESSES;

export const POINT_TOKEN_NAMES = {
    '0x167d4D53c5259814CD1F4dF6B4e361c5eEDa89ee': 'Michi Kelp Mile',
    '0xfe921de34570da8040a9247a9dc21cf539942402': 'Michi Ethena Sat',
    '0x3c6f26acacfe292232ea1751c5d7fc5641123482': 'Michi Eigenlayer Point'
};