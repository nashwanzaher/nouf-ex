/**
 * Upload routes — file upload endpoints.
 *
 * SECURITY (OWASP ASVS 12.1.1):
 *   - All upload endpoints require authentication
 *   - MIME type validation on upload
 *   - File size limits enforced
 *   - Safe filename generation
 */
import { Router } from 'express';
import { requireAuth } from '../../lib/shared.ts';
import {
	uploadSingleImage,
	uploadMultipleImages,
	uploadSingleFile,
	uploadImageHandler,
	uploadImagesHandler,
	uploadDocumentHandler,
	deleteFileHandler,
} from './controller.ts';

export const uploadsRouter = Router();

// All upload endpoints require authentication
uploadsRouter.post('/image', requireAuth, uploadSingleImage, uploadImageHandler);
uploadsRouter.post('/images', requireAuth, uploadMultipleImages, uploadImagesHandler);
uploadsRouter.post('/document', requireAuth, uploadSingleFile, uploadDocumentHandler);
uploadsRouter.delete('/:filename', requireAuth, deleteFileHandler);
