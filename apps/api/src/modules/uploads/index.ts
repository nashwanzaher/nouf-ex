/**
 * Uploads module — file upload functionality.
 */
export { uploadsRouter } from './routes.ts';
export { uploadSingleImage, uploadMultipleImages, uploadSingleFile } from './controller.ts';
export { getImageUploadConfig, getDocumentUploadConfig, deleteFile } from './storage.ts';
