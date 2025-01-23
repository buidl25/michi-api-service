import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/db';
import { UserService } from './user.service';
import { UserController } from './user.controller';

@Module({
    imports: [PrismaModule],
    providers: [UserService],
    exports: [UserService],
    controllers: [UserController]
})

export class UserModule {}