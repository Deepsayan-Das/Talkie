import { S3Client } from '@aws-sdk/client-s3';
import env from './env';
export const s3 = new S3Client({
    endpoint: `http://${env.minio.endpoint}:${env.minio.port}`,
    region: 'ap-south-1',
    credentials: {
        accessKeyId: env.minio.access_key,
        secretAccessKey: env.minio.secret_key
    },
    forcePathStyle: true, // important for minio 

})