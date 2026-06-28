import { Router } from "express";
import { uploadFileController, getFileController, deleteFileController, getFilePresignedUrlController } from "../controllers/file.controller";
const fileRouter = Router();

fileRouter.post('/upload', uploadFileController);
fileRouter.get('/presigned/:id', getFilePresignedUrlController);
fileRouter.get('/:id', getFileController);
fileRouter.delete('/:id', deleteFileController);


export default fileRouter;