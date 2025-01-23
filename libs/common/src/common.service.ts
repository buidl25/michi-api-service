import { Injectable, Logger } from '@nestjs/common';
import { MoralisService } from '@app/moralis';
import { PrismaService } from '@app/db';
import { Prisma } from '@prisma/client';
import { TokenboundService } from '@app/tokenbound';
import { FIFTEEN_SECONDS } from '@app/constants';

@Injectable()
export class CommonService {
    private readonly logger = new Logger(CommonService.name);

    constructor(
        private readonly moralis: MoralisService,
        private readonly prisma: PrismaService,
        private readonly tokenbound: TokenboundService
    ) {}

    async backfillMissingWalletCreates(chainId: string, startIndex: number, endIndex: number) {
        const walletBackfillData: Prisma.MichiWalletUncheckedCreateInput[] = [];
        const ownerList = await this.moralis.getMichiNFTOwnerBatched(chainId, startIndex, endIndex);
        for (let i = startIndex; i < endIndex; i++) {
            const walletAddress = this.tokenbound.getAccount(chainId, i.toString());
            const owner = ownerList[i - startIndex];
            this.logger.log(`Setting wallet index ${i} with walletAddress = ${walletAddress} and owner = ${owner}`);
            walletBackfillData.push({
                chain_id: chainId,
                nft_index: i,
                wallet_address: walletAddress,
                owner_address: owner,
                stale_at: new Date(new Date().getTime() + FIFTEEN_SECONDS)
            });
        }
        this.logger.log('Pushing backfilled data to DB');
        await this.prisma.setMichiWallets(walletBackfillData);
    }

}
