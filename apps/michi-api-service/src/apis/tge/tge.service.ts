import { Injectable } from '@nestjs/common';
import { ethers, keccak256 } from 'ethers';
import { MerkleTree } from 'merkletreejs';

import * as CLAIM_AMOUNTS from '@app/config/tge/claim-amounts.json';
import { PointsService } from '../points/points.service';
import { NFTService } from '../nft/nft.service';
import { PrismaService } from '@app/db';
import { ARBITRUM_CHAIN_ID, EIGENLAYER, ETH_MAINNET_CHAIN_ID, ThirdPartyPlatform } from '@app/constants';
import Decimal from 'decimal.js';

@Injectable()
export class TgeService {
    private tree: MerkleTree | null = null;
    private root: string | null = null;
    private data: Array<{ index: number, address: string, amount: string }> = [];

    constructor(
        private readonly pointsService: PointsService,
        private readonly nftService: NFTService,
        private readonly prisma: PrismaService,
    ) {}

    async onModuleInit() {
        this.buildTree();
    }

    getRoot() {
        return this.root;
    }

    async getClaim(address: string) {
        const item = this.data.find(item => item.address.toLowerCase() === address.toLowerCase());
        if (!item) return null;

        const leaf = this.createLeaf(item.index, item.address, item.amount);

        if (!this.tree) return null;
        const proof = this.tree.getHexProof(leaf);

        const ownedWallets: any[] = await this.nftService.getOwnedMichiWallets(address);
        const ownedWalletAddresses = ownedWallets.map(wallet => wallet.walletAddress);
    
        return { 
            index: item.index,
            address: item.address,
            amount: item.amount, 
            proof,
            points: await this.getWalletPoints(ownedWalletAddresses),
            walletsOwned: ownedWalletAddresses.length,
        };
    }

    buildTree() {
        this.data = CLAIM_AMOUNTS.map((item, index) => ({ ...item, index }));

        const leaves = this.data.map(item => this.createLeaf(item.index, item.address, item.amount));
        this.tree = new MerkleTree(leaves, keccak256, { sortPairs: true, duplicateOdd: true });
        this.root = this.tree.getHexRoot();
    }

    private createLeaf(index: number, address: string, amount: string) {
        return ethers.solidityPackedKeccak256(
            ['uint256', 'address', 'uint256'],
            [index, address, amount]
        );
    }

    async getWalletPoints(ownedWalletAddresses) {
        const walletPoints = await this.prisma.getThirdPartyPointsBulk(ownedWalletAddresses);

        const responseData = [];
        let totalElPoints = new Decimal(0);

        for (const point of walletPoints) {
            totalElPoints = totalElPoints.plus(point.el_points);
            if (point.points > new Decimal(0)) {
                responseData.push({
                    platform: point.platform as ThirdPartyPlatform,
                    points: point.points.toFixed()
                });
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
