import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { UnexpectedExceptionsFilter } from './filters/exceptions.filter';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from '@app/config';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        // replace the default nestjs logger with winston
        logger: WinstonModule.createLogger(winstonConfig),
    });

    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe());
    app.enableCors({
        origin: function (origin, callback) {
            if (!origin 
                || origin == process.env.FRONTEND_URL 
                || origin.endsWith('michiwallet.com') 
                || origin.includes('localhost')
                || origin.endsWith('pichi.finance')) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        exposedHeaders: ['set-cookie']
    });
    app.useGlobalFilters(new UnexpectedExceptionsFilter());

    // Necessary to rate limit by IP address from behind a load balancer
    app.getHttpAdapter().getInstance().set('trust proxy', 1);

    await app.listen(process.env.PORT || 5001);
}

bootstrap();
