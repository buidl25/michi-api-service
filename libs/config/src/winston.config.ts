
import * as winston from 'winston';
import { WinstonModuleOptions } from 'nest-winston';

export const winstonConfig: WinstonModuleOptions = {
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'DD/MM/YYYY HH:mm:ss.SSS',
        }),
        winston.format.errors({stack: true}),
        winston.format.printf(({ level: logLevel, message, timestamp, ...metadata }) => {
            return `${timestamp} | ${logLevel.toUpperCase()} | ${message} ${JSON.stringify(metadata)}`;
        }),
        winston.format.uncolorize()
    ),
    transports: [new winston.transports.Console()],
};

