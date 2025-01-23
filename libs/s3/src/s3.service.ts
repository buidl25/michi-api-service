import { Injectable } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { fromEnv } from '@aws-sdk/credential-providers';

@Injectable()
export class S3Service {
    private s3Client: S3Client;

    constructor() {
        const clientConfig: any = {region: process.env.AWS_REGION};
        if (process.env.ENV == 'development') {
            clientConfig.credentials = fromEnv();
        }
        this.s3Client = new S3Client(clientConfig);
    }

    async uploadFile(bucket: string, key: string, body: any, contentType: string) {
        const params = {
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
        };
        
        return await this.s3Client.send(new PutObjectCommand(params));
    }

    async getFileAsJson(bucket: string, key: string): Promise<any> {
        const params = {
            Bucket: bucket,
            Key: key,
        };

        const response = await this.s3Client.send(new GetObjectCommand(params));
        
        const streamToString = (stream: Readable): Promise<string> =>
            new Promise((resolve, reject) => {
                const chunks: Uint8Array[] = [];
                stream.on('data', (chunk) => chunks.push(chunk));
                stream.on('error', reject);
                stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
            });

        const bodyContents = await streamToString(response.Body as Readable);
        return JSON.parse(bodyContents);
    }
}
