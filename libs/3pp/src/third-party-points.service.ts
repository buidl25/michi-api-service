import { Injectable, Logger } from '@nestjs/common';
import { POINT_TOKEN_ADDRESSES, THIRD_PARTY_PLATFORMS_API_URLS, ThirdPartyPlatform } from '@app/constants';
import { ThirdPartyRawPointsData } from '@app/models';
import axios from 'axios';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { exponentialBackoff, getRandomNumber, truncateStr } from '@app/utils';

type PlatformDataProcessor = (data: any) => ThirdPartyRawPointsData;
const TIMEOUT = 10000;

const AMPHOR_GEN_POINTS_MAP = new Map<string, ThirdPartyPlatform>([
    ['Mellow points', ThirdPartyPlatform.MELLOW],
    ['Symbiotic points', ThirdPartyPlatform.SYMBIOTIC],
    ['Mellow points', ThirdPartyPlatform.MELLOW],
    ['Zircuit points', ThirdPartyPlatform.ZIRCUIT],
    ['Karak XP', ThirdPartyPlatform.KARAK],
    ['renzo', ThirdPartyPlatform.RENZO]
]);

@Injectable()
export class ThirdPartyPointsService {
    private readonly logger = new Logger(ThirdPartyPointsService.name);

    private readonly thirdPartyDataProcessingMap = new Map<ThirdPartyPlatform, PlatformDataProcessor>([
        [ThirdPartyPlatform.KELPDAO, this.processKelpDaoData],
        [ThirdPartyPlatform.ETHERFI, this.processEtherfiData],
        [ThirdPartyPlatform.RENZO, this.processRenzoData],
        [ThirdPartyPlatform.BEDROCK, this.processBedrockData],
        [ThirdPartyPlatform.SWELL, this.processSwellData],
        [ThirdPartyPlatform.ETHENA, this.processEthenaData],
        [ThirdPartyPlatform.POWDER, this.processPowderData],
        [ThirdPartyPlatform.PILLS, this.processPillsData],
        [ThirdPartyPlatform.CORN, this.processCornData],
        [ThirdPartyPlatform.MELLOW, this.processMellowData],
        [ThirdPartyPlatform.SYMBIOTIC, this.processSymbioticData],
        [ThirdPartyPlatform.KARAK, this.processKarakData],
        [ThirdPartyPlatform.AMPHOR, this.processAmphorData],
    ]);

    constructor() {}

    async fetchThirdPartyPointTotalsWithRetries(address: string, platforms: ThirdPartyPlatform[], retries = 7): Promise<ThirdPartyRawPointsData[]> {
        const thirdPartyPointTotalPromises = platforms.map(async platform => {
            try {
                return await exponentialBackoff(async () => {
                    return this.fetchPlatformDataFromUrl(platform, address, THIRD_PARTY_PLATFORMS_API_URLS[platform]);
                }, this.logger, retries);
            } catch (error) {
                this.logger.error(`Failed to get points for platform ${platform}: ${error}`);
                return {
                    platform: platform,
                    points: null,
                    elPoints: null
                };
            }
        });
        return await Promise.all(thirdPartyPointTotalPromises);
    }

    fetchMockPointTotals(platforms: ThirdPartyPlatform[]): ThirdPartyRawPointsData[] {
        let firstElement = false;
        return platforms.filter(platform => Object.keys(POINT_TOKEN_ADDRESSES).includes(platform)).map(platform => {
            const randomPoints = firstElement ? null : getRandomNumber(100, 1000).toString();
            firstElement = false;
            return {
                platform: platform,
                points: randomPoints,
                elPoints: randomPoints
            };
        });
    }

    async fetchPlatformDataFromUrl(platform: ThirdPartyPlatform, address: string, urlTemplate: string): Promise<ThirdPartyRawPointsData> {
        if (platform === ThirdPartyPlatform.POWDER) {
            return await this.handlePowderFetch(address);
        } else if (platform === ThirdPartyPlatform.ZIRCUIT) {
            return {
                platform: ThirdPartyPlatform.ZIRCUIT,
                points: '0',
                elPoints: '0'
            };
        } else {
            const checkSummedAddress = ethers.getAddress(address);
            const res = await axios.get(urlTemplate.replace('{address}', checkSummedAddress), {timeout: TIMEOUT});
            return this.thirdPartyDataProcessingMap.get(platform)(res.data);
        }
    }

    private processKelpDaoData(data: any): ThirdPartyRawPointsData {
        return {
            platform: ThirdPartyPlatform.KELPDAO,
            points: truncateStr(new BigNumber(data.value.kelpMiles).toString()),
            elPoints: truncateStr(new BigNumber(data.value.elPoints).toString())
        };
    }
    private processEtherfiData(data: any): ThirdPartyRawPointsData {
        return {
            platform: ThirdPartyPlatform.ETHERFI,
            points: truncateStr(data.totalLoyaltyPoints.toString()),
            elPoints: truncateStr(data.totalEigenlayerPoints.toString())
        };
    }
    private processRenzoData(data: any): ThirdPartyRawPointsData {
        return {
            platform: ThirdPartyPlatform.RENZO,
            points: truncateStr(data.data.totals.renzoPoints.toString()),
            elPoints: truncateStr(data.data.totals.eigenLayerPoints.toString())
        };
    }

    private processBedrockData(data: any): ThirdPartyRawPointsData {
        if (data.code != 200) {
            return {
                platform: ThirdPartyPlatform.BEDROCK,
                points: '0',
                elPoints: '0'
            };
        }
        return {
            platform: ThirdPartyPlatform.BEDROCK,
            points: truncateStr(new BigNumber(data.data.totalPoint).toString()),
            elPoints: truncateStr(new BigNumber(data.data.totalEigenPodPoint).toString())
        };
    }

    private processSwellData(data: any): ThirdPartyRawPointsData {
        return {
            platform: ThirdPartyPlatform.SWELL,
            points: truncateStr(data.points.toString()),
            elPoints: truncateStr(data.elPoints.toString())
        };
    }

    private processEthenaData(data: any): ThirdPartyRawPointsData {
        if (data.queryWallet?.length > 0) {
            return {
                platform: ThirdPartyPlatform.ETHENA,
                points: truncateStr(data.queryWallet[0].accumulatedTotalShardsEarned.toString()),
                elPoints: '0'
            };
        } else {
            return {
                platform: ThirdPartyPlatform.ETHENA,
                points: '0',
                elPoints: '0'
            };
        }
    }

    private processPillsData(data: any): ThirdPartyRawPointsData {
        return {
            platform: ThirdPartyPlatform.PILLS,
            points: truncateStr(data.totalPoints.toString()),
            elPoints: '0'
        };
    }

    private processCornData(data: any): ThirdPartyRawPointsData {
        return {
            platform: ThirdPartyPlatform.CORN,
            points: truncateStr(data.balance.toString()),
            elPoints: '0'
        };
    }

    private processMellowData(data: any): ThirdPartyRawPointsData {
        let points = new BigNumber(0);
        for (const obj of data) {
            points = points.plus(new BigNumber(obj.user_mellow_points));
        }

        return {
            platform: ThirdPartyPlatform.MELLOW,
            points: truncateStr(points.toString()),
            elPoints: '0'
        };
    }

    private processSymbioticData(data: any): ThirdPartyRawPointsData {
        let points = new BigNumber(0);
        for (const obj of data) {
            points = points.plus(new BigNumber(obj.user_symbiotic_points));
        }

        return {
            platform: ThirdPartyPlatform.SYMBIOTIC,
            points: truncateStr(points.toString()),
            elPoints: '0'
        };
    }

    private processKarakData(data: any): ThirdPartyRawPointsData {
        return {
            platform: ThirdPartyPlatform.KARAK,
            points: truncateStr(data.toString()),
            elPoints: '0'
        };
    }

    private processAmphorData(data: any): ThirdPartyRawPointsData {
        const generatedPoints = [];
        for (const [key, platform] of AMPHOR_GEN_POINTS_MAP.entries()) {   
            if (key in data.infos.generated_points) {
                generatedPoints.push({
                    platform: platform,
                    points: truncateStr(data.infos.generated_points[key].toString())
                });
            }
        }
        return {
            platform: ThirdPartyPlatform.AMPHOR,
            points: truncateStr(data.infos.points.toString()),
            elPoints: '0',
            generatedPoints: generatedPoints
        };
    }

    private processPowderData(data: any): ThirdPartyRawPointsData {
        return {
            platform: ThirdPartyPlatform.POWDER,
            points: truncateStr(data.data.totalPoints.toString()),
            elPoints: '0'
        };
    }

    private processMantleEigenData(data: any): ThirdPartyRawPointsData {
        return {
            platform: ThirdPartyPlatform.POWDER,
            points: '0',
            elPoints: truncateStr(data.balance.eigenLayerTotalPoints.toString())
        };
    }

    // Annoyingly the data is in two diff endpoints here
    async handlePowderFetch(address: string) {
        let checkSummedAddress = ethers.getAddress(address);
        const urlTemplate = THIRD_PARTY_PLATFORMS_API_URLS[ThirdPartyPlatform.POWDER];
        let res = await axios.get(urlTemplate.replace('{address}', checkSummedAddress), {timeout: TIMEOUT});
        const powderData = this.thirdPartyDataProcessingMap.get(ThirdPartyPlatform.POWDER)(res.data);

        checkSummedAddress = ethers.getAddress(address);
        res = await axios.get(`https://meth.mantle.xyz/api/balance/${checkSummedAddress}`, {timeout: TIMEOUT});
        const eigenData = this.processMantleEigenData(res.data);
        
        return {
            platform: powderData.platform,
            points: powderData.points,
            elPoints: eigenData.elPoints,
        };
    }
}