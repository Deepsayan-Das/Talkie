import { s3 } from "../config/s3";
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import env from "../config/env";

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