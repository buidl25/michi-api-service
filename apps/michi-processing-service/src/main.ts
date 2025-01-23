import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from '@app/config';

async function bootstrap() {
    await NestFactory.createApplicationContext(AppModule, {
        // replace the default nestjs logger with winston
        logger: WinstonModule.createLogger(winstonConfig),
    });
}

bootstrap().catch(console.error);
