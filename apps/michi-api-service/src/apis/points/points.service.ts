import { Injectable, Logger } from '@nestjs/common';
import { CHAIN_NAMES, EIGENLAYER, THIRD_PARTY_PLATFORMS_API_URLS, ThirdPartyPlatform } from '@app/constants';
import { PrismaService } from '@app/db';
import { MichiPointsResponse, PointsLeaderboardResponseData, PointsLeaderboardUserData, ThirdPartyPointsResponseData, ThirdPartyRawPointsData, TotalPointsResponseData } from '@app/models';
import Decimal from 'decimal.js';
import { ThirdPartyPointsService } from '@app/3pp';
import { ThirdPartyPoints } from '@prisma/client';

@Injectable()
export class PointsService {
    private readonly logger = new Logger(PointsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly thirdPartyPointsService: ThirdPartyPointsService 
    ) {}

    async getTotalPoints(): Promise<ThirdPartyPointsResponseData[]> {
        return await this.prisma.getTotalThirdPartyPoints();
    }

    async getTotalMichiPoints(): Promise<TotalPointsResponseData> {
        const michiTotalPointsData = await this.prisma.getTotalMichiPoints();

        let totalPoints = new Decimal(0);
        for (const chainData of michiTotalPointsData) {
            totalPoints = totalPoints.add(chainData.totalChainPoints);
        }

        return {
            pointsType: 'Michi',
            totalPoints: totalPoints.round().toString(),
            chainData: michiTotalPointsData.map(data => ({
                ...data,
                totalChainPoints: data.totalChainPoints.round()
            }))
        };
    }

    async getMichiPointsLeaderboard(limit: number, offset: number): Promise<PointsLeaderboardResponseData> {
        const users = await this.prisma.getMichiPointsLeaderboard(limit, offset);
        const userDataAcrossChains = await this.prisma.getUsersBulk(users.map(user => user.address));

        const leaderboardUserData: PointsLeaderboardUserData[] = users.map((user, index) => {
            const chainDataRows = userDataAcrossChains.filter(row => row.address == user.address);
            return {
                position: index + offset + 1,
                address: user.address,
                totalPoints: user._sum.michi_points.round(),
                chainData: chainDataRows.map(row => ({
                    chain: CHAIN_NAMES[row.chain_id],
                    chainId: row.chain_id,
                    points: row.michi_points.round()
                }))
            };
        });

        return { users: leaderboardUserData };
    }

    async getMichiPoints(address: string): Promise<MichiPointsResponse> {
        const pointsData = await this.prisma.getMichiPointsAndRank(address);
        if (!pointsData) {
            return {
                points: '0',
                rank: null
            };
        } else {
            return {
                points: pointsData.michi_points.round(),
                rank: parseInt(pointsData.rank)
            };
        }
    }

    async getThirdPartyPoints(address: string) {
        const cachedPointsData: ThirdPartyRawPointsData[] = await this.getCachedThirdPartyPoints(address);
        const hydratedPointsData = await this.hydrateThirdPartyPointsData(address, cachedPointsData);
        return this.buildPointsResponseDataFromRawPointsDataType(hydratedPointsData);
    }

    async getCachedThirdPartyPoints(address: string): Promise<ThirdPartyRawPointsData[]> {
        const fetchedData = await this.prisma.getThirdPartyPoints(address);

        return Object.values(ThirdPartyPlatform).map(platform => {
            const platformData = fetchedData.find(d => d.platform === platform);
            if (platformData) {
                return {
                    platform: platformData.platform as ThirdPartyPlatform,
                    points: platformData.points.toString(),
                    elPoints: platformData.el_points.toString(),
                    staleAt: platformData.stale_at
                };
            } else {
                return {
                    platform: platform,
                    points: '0',
                    elPoints: '0',
                    staleAt: null
                };
            }
        });
    }

    private async hydrateThirdPartyPointsData(address: string, pointsData: ThirdPartyRawPointsData[]): Promise<ThirdPartyRawPointsData[]> {
        return Promise.all(pointsData.map(async (rawPoints: ThirdPartyRawPointsData) => {
            if (new Date() > rawPoints.staleAt || rawPoints.platform === ThirdPartyPlatform.AMPHOR) {
                try {
                    const fetchedPointsData = await this.thirdPartyPointsService.fetchPlatformDataFromUrl(
                        rawPoints.platform, address, THIRD_PARTY_PLATFORMS_API_URLS[rawPoints.platform]
                    );
                    // TODO: bulk update the db after getting all points data
                    const newPoints = fetchedPointsData.points == '0' ? rawPoints.points : fetchedPointsData.points;
                    const newElPoints = fetchedPointsData.elPoints == '0' ? rawPoints.elPoints : fetchedPointsData.elPoints;
                    await this.prisma.setThirdPartyPoints(address, rawPoints.platform, newPoints, newElPoints);
                    return fetchedPointsData;
                } catch (error) {
                    this.logger.error(`Failed to get points for platform ${rawPoints.platform}: ${error}`);
                }
            }
            return rawPoints;
        }));
    }

    buildPointsResponseDataFromRawPointsDataType(pointsData: ThirdPartyRawPointsData[]): ThirdPartyPointsResponseData[] {
        let amphorGeneratedPoints = null;
        for (const data of pointsData) {
            if ('generatedPoints' in data) {
                amphorGeneratedPoints = data['generatedPoints'];
            }
        }
        return this.buildPointsResponseData(
            pointsData.map(pointData => ({
                id: 0, // placeholder value
                address: '', // placeholder value
                platform: pointData.platform, 
                points: new Decimal(pointData.points), 
                el_points: new Decimal(pointData.elPoints),
                stale_at: pointData.staleAt,
            })),
            amphorGeneratedPoints
        );
    }

    buildPointsResponseData(points: ThirdPartyPoints[], amphorGeneratedPoints?: any[]): ThirdPartyPointsResponseData[] {
        if (!points) return [];
        const responseData: ThirdPartyPointsResponseData[] = [];
        let totalElPoints = new Decimal(0);

        for (const point of points) {
            totalElPoints = totalElPoints.plus(point.el_points);
            if (point.points > new Decimal(0)) {
                responseData.push({
                    platform: point.platform as ThirdPartyPlatform,
                    points: point.points.toFixed()
                });
            }
        }

        if (amphorGeneratedPoints) {
            for (const data of amphorGeneratedPoints) {
                const val = new Decimal(data.points);
                if (val.eq(new Decimal(0))) continue;
                const existingPlatform = responseData.find(item => item.platform === data.platform);
                if (existingPlatform) {
                    existingPlatform.points = new Decimal(existingPlatform.points).plus(val).toFixed();
                } else {
                    responseData.push({
                        platform: data.platform as ThirdPartyPlatform,
                        points: val.toFixed()
                    });
                }
            }
        }

        if (totalElPoints > new Decimal(0)) {
            responseData.push({
                platform: EIGENLAYER,
                points: totalElPoints.toFixed()
            });
        }

        return responseData;
    }
}