import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './user.dto';

@Controller({version: ['1'], path: 'user'})
export class UserController {

    constructor(private readonly userService: UserService) {}

    @Post()
    async createUser(@Body() body: CreateUserDto) {
        return await this.userService.createAccountWithReferrer(body.address.toLowerCase(), body.affiliateId);
    }

    @Get(':chain/:address/nonce')
    async getNonce(@Param('chain') chain: string, @Param('address') address: string) {
        return this.userService.getUserNonce(chain, address.toLowerCase());
    }

    @Get(':address/affiliate')
    async getAffiliateStats(@Param('address') address: string) {
        return await this.userService.getAffiliateStats(address.toLowerCase());
    }

    @Get(':address/affiliate/link')
    async getAffiliateLink(@Param('address') address: string) {
        return await this.userService.generateAffiliateLink(address.toLowerCase());
    }
}