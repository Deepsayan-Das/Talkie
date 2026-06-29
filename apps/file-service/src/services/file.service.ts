import { createFile, deleteFile, findFileById, findFilesByOwnerId } from "../repository/file.repository";
import { uploadFile, deleteS3Object, getPresignedUrl } from "../repository/s3.repository";
import env from "../config/env";
import logger from "../config/logger";


export const uploadFileService = async (ownerId: string, file: Express.Multer.File) => {
    if (!file.buffer) {
        logger.error('File upload failed — buffer is missing', { ownerId, originalName: file.originalname });
        throw new Error('File buffer is missing. Ensure multer is configured with memoryStorage.');
    }
    const fileKey = `uploads/${ownerId}/${Date.now()}-${file.originalname}`;
    logger.info('Uploading file to S3', { ownerId, fileKey, size: file.size, mimeType: file.mimetype });
    await uploadFile(fileKey, file.buffer, file.mimetype);
    const record = await createFile({
        owner_id: ownerId,
        original_name: file.originalname,
        mime_type: file.mimetype,
        size: file.size,
        storage_key: fileKey,
        url: `http://${env.minio.endpoint}:${env.minio.port}/${env.minio.bucket}/${fileKey}`
    });
    logger.info('File uploaded and record created', { ownerId, fileKey, fileId: record.id });
    return record;
}

export const getFile = async (fileId: string) => {
    logger.info('Fetching file record', { fileId });
    const file = await findFileById(fileId);
    if (!file) {
        logger.warn('File not found', { fileId });
        throw new Error('File not found');
    }
    return file;
}

export const getFileByUserId = async (ownerId: string) => {
    logger.info('Fetching files by owner', { ownerId });
    const files = await findFilesByOwnerId(ownerId);
    logger.info('Files fetched', { ownerId, count: files.length });
    return files;
}

export const deleteFileService = async (fileId: string, requester_id: string) => {
    logger.info('Delete file requested', { fileId, requester_id });
    const file = await findFileById(fileId);
    if (!file) {
        logger.warn('Delete file failed — file not found', { fileId });
        throw new Error('File not found');
    }
    if (file.owner_id !== requester_id) {
        logger.warn('Delete file failed — unauthorized', { fileId, requester_id, owner_id: file.owner_id });
        throw new Error('Unauthorized');
    }
    await deleteS3Object(file.storage_key);
    await deleteFile(fileId);
    logger.info('File deleted from S3 and DB', { fileId, storageKey: file.storage_key });
}

export const getFilePresignedUrlService = async (fileId: string, expiresAt?: number) => {
    logger.info('Generating presigned URL', { fileId, expiresIn: expiresAt || 3600 });
    const file = await findFileById(fileId);
    if (!file) {
        logger.warn('Presigned URL failed — file not found', { fileId });
        throw new Error('File not found');
    }
    const presignedUrl = await getPresignedUrl(file.storage_key, expiresAt || 60 * 60);
    logger.info('Presigned URL generated', { fileId, storageKey: file.storage_key });
    return presignedUrl;
}
