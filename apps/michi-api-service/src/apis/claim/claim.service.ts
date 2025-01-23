import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { lastValueFrom } from 'rxjs';


export interface ClaimDataResponse {
  amount: string;
  index: number;
  proof: string[];
}

@Injectable()
export class ClaimService {
    constructor(private readonly httpService: HttpService) {
    }

    async getClaimData(address: string, allocation: string, chainId: number): Promise<ClaimDataResponse> {
        const url = `https://claim.ether.fi/api/s2-claim-data?address=${address}&allocation=${allocation}&chainId=${chainId}`;
        const response: AxiosResponse<ClaimDataResponse> = await lastValueFrom(this.httpService.get<ClaimDataResponse>(url));
        return response.data;
    }
}
