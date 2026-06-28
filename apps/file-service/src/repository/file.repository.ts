import { FileData, FileRecord } from '../models/file.model';
import db from '../db/knex';

export const createFile = async (data: FileData) => {
    const [file] = await db('files').insert(data).returning('*');
    return file as FileRecord;
}

export const findFileById = async (fileId: string) => {
    return await db('files').where({ id: fileId }).first();
}

export const findFilesByOwnerId = async (ownerId: string) => {
    return await db('files').where({ owner_id: ownerId });
}

export const deleteFile = async (fileId: string) => {
    return await db('files').where({ id: fileId }).del();
}
