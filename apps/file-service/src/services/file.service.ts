import { createFile, deleteFile, findFileById, findFilesByOwnerId } from "../repository/file.repository";
import { uploadFile, deleteS3Object, getPresignedUrl } from "../repository/s3.repository";
import env from "../config/env";


export const uploadFileService = async (ownerId: string, file: Express.Multer.File) => {
    if (!file.buffer) throw new Error('File buffer is missing. Ensure multer is configured with memoryStorage.');
    const fileKey = `uploads/${ownerId}/${Date.now()}-${file.originalname}`;
    await uploadFile(fileKey, file.buffer, file.mimetype);
    return createFile({
        owner_id: ownerId,
        original_name: file.originalname,
        mime_type: file.mimetype,
        size: file.size,
        storage_key: fileKey,
        url: `http://${env.minio.endpoint}:${env.minio.port}/${env.minio.bucket}/${fileKey}`
    });
}

export const getFile = async (fileId: string) => {
    const file = await findFileById(fileId);
    if (!file) throw new Error('File not found');

    return file;
}

export const getFileByUserId = async (ownerId: string) => {
    const files = await findFilesByOwnerId(ownerId);
    return files;
}

export const deleteFileService = async (fileId: string, requester_id: string) => {
    const file = await findFileById(fileId);
    if (!file) throw new Error('File not found');
    if (file.owner_id !== requester_id) throw new Error('Unauthorized');
    await deleteS3Object(file.storage_key);
    await deleteFile(fileId);
}

export const getFilePresignedUrlService = async (fileId: string, expiresAt?: number) => {
    const file = await findFileById(fileId);
    if (!file) throw new Error('File not found');
    const presignedUrl = await getPresignedUrl(file.storage_key, expiresAt || 60 * 60);
    return presignedUrl;
}
