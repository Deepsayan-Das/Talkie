import { s3 } from "../config/s3";
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import env from "../config/env";
import logger from "../config/logger";

export const initS3 = async () => {
    try {
        await s3.send(new HeadBucketCommand({ Bucket: env.minio.bucket }));
        logger.info(`Bucket ${env.minio.bucket} already exists.`);
    } catch (error: any) {
        if (error.$metadata?.httpStatusCode === 404 || error.name === 'NotFound') {
            logger.info(`Bucket ${env.minio.bucket} does not exist. Creating...`);
            await s3.send(new CreateBucketCommand({ Bucket: env.minio.bucket }));
            logger.info(`Bucket ${env.minio.bucket} created.`);

            // Make bucket public read
            const policy = {
                Version: "2012-10-17",
                Statement: [
                    {
                        Sid: "PublicReadGetObject",
                        Effect: "Allow",
                        Principal: "*",
                        Action: "s3:GetObject",
                        Resource: `arn:aws:s3:::${env.minio.bucket}/*`
                    }
                ]
            };
            await s3.send(new PutBucketPolicyCommand({
                Bucket: env.minio.bucket,
                Policy: JSON.stringify(policy)
            }));
            logger.info(`Bucket ${env.minio.bucket} policy set to public read.`);
        } else {
            logger.error(`Error checking bucket ${env.minio.bucket}:`, error);
            throw error;
        }
    }
}

export const uploadFile = async (key: string, body: Buffer, mimeType: string) => {
    const command = new PutObjectCommand({
        Bucket: env.minio.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType
    });
    await s3.send(command);
}

export const deleteS3Object = async (key: string) => {
    const command = new DeleteObjectCommand({
        Bucket: env.minio.bucket,
        Key: key,
    });
    await s3.send(command);
}

export const getPresignedUrl = async (key: string, expiry: number) => {
    const command = new GetObjectCommand({
        Bucket: env.minio.bucket,
        Key: key,
    });
    const url = await getSignedUrl(s3, command, { expiresIn: expiry });
    return url;
}