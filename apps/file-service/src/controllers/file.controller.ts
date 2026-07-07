import { Request, Response } from 'express';
import { upload } from '../middleware/upload.middleware';
import { uploadFileService, getFile, deleteFileService, getFilePresignedUrlService } from '../services/file.service';

export const uploadFileController = [
    upload.single('file'),
    async (req: Request, res: Response) => {
        const rawUserId = req.headers['x-user-id'];
        const ownerId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

        if (!ownerId) {
            return res.status(400).json({ success: false, message: 'Missing User ID header' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file provided' });
        }

        try {
            const file = await uploadFileService(ownerId, req.file);
            // Return just the url the frontend needs — full record is unnecessary over the wire
            return res.status(201).json({ success: true, data: { url: file.url, id: file.id } });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message ?? 'Internal server error' });
        }
    }
];

export const getFileController = async (req: Request, res: Response) => {
    const rawUserId = req.headers['x-user-id'];
    const requesterId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

    if (!requesterId) {
        return res.status(400).json({ success: false, message: 'Missing User ID header' });
    }

    const fileId = req.params.id;

    try {
        const file = await getFile(fileId as string);
        return res.status(200).json({ success: true, data: file });
    } catch (error: any) {
        if (error.message === 'File not found') {
            return res.status(404).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const deleteFileController = async (req: Request, res: Response) => {
    const rawUserId = req.headers['x-user-id'];
    const requesterId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

    if (!requesterId) {
        return res.status(400).json({ success: false, message: 'Missing User ID header' });
    }

    const fileId = req.params.id;

    try {
        await deleteFileService(fileId as string, requesterId);
        return res.status(200).json({ success: true, message: 'File deleted successfully' });
    } catch (error: any) {
        if (error.message === 'File not found') {
            return res.status(404).json({ success: false, message: error.message });
        }
        if (error.message === 'Unauthorized') {
            return res.status(403).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const getFilePresignedUrlController = async (req: Request, res: Response) => {
    const rawUserId = req.headers['x-user-id'];
    const requesterId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

    if (!requesterId) {
        return res.status(400).json({ success: false, message: 'Missing User ID header' });
    }

    const fileId = req.params.id;
    const expiresAt = req.query.expires_at;

    try {
        const file = await getFilePresignedUrlService(fileId as string, expiresAt ? parseInt(expiresAt as string) : undefined);
        return res.status(200).json({ success: true, data: file });
    } catch (error: any) {
        if (error.message === 'File not found') {
            return res.status(404).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}