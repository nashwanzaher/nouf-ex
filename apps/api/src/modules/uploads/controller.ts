/**
 * Upload controller — handles file upload endpoints.
 *
 * SECURITY (OWASP ASVS 12.1.1):
 *   - Validates MIME type against allowlist
 *   - Enforces file size limits
 *   - Generates safe random filenames
 *   - Returns relative URLs (not filesystem paths)
 */
import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { ErrorCodes } from '../../lib/error-codes.ts';
import { sendError, sendSuccess } from '../../lib/shared.ts';
import {
	generateSafeFilename,
	getImageUploadConfig,
	getDocumentUploadConfig,
	deleteFile,
	ALLOWED_IMAGE_TYPES,
	ALL_ALLOWED_TYPES,
} from './storage.ts';

/**
 * Configure multer for image uploads.
 */
const imageStorage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		const config = getImageUploadConfig();
		cb(null, config.uploadDir);
	},
	filename: (_req, file, cb) => {
		cb(null, generateSafeFilename(file.originalname));
	},
});

/**
 * File filter for image uploads.
 * SECURITY: validates MIME type before saving.
 */
function imageFileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
	if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`));
	}
}

/**
 * Configure multer for general uploads (images + documents).
 */
const generalStorage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		const config = getDocumentUploadConfig();
		cb(null, config.uploadDir);
	},
	filename: (_req, file, cb) => {
		cb(null, generateSafeFilename(file.originalname));
	},
});

function generalFileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
	if (ALL_ALLOWED_TYPES.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${ALL_ALLOWED_TYPES.join(', ')}`));
	}
}

/** Multer middleware for single image upload */
export const uploadSingleImage = multer({
	storage: imageStorage,
	fileFilter: imageFileFilter,
	limits: {
		fileSize: getImageUploadConfig().maxFileSize,
		files: 1,
	},
}).single('image');

/** Multer middleware for multiple image uploads (max 10) */
export const uploadMultipleImages = multer({
	storage: imageStorage,
	fileFilter: imageFileFilter,
	limits: {
		fileSize: getImageUploadConfig().maxFileSize,
		files: 10,
	},
}).array('images', 10);

/** Multer middleware for general file upload */
export const uploadSingleFile = multer({
	storage: generalStorage,
	fileFilter: generalFileFilter,
	limits: {
		fileSize: getDocumentUploadConfig().maxFileSize,
		files: 1,
	},
}).single('file');

/**
 * POST /api/uploads/image
 * Upload a single image.
 */
export async function uploadImageHandler(req: Request, res: Response) {
	try {
		if (!req.file) {
			return sendError(res, 'No file uploaded', 400, ErrorCodes.VALIDATION_ERROR);
		}

		const config = getImageUploadConfig();
		const url = `${config.urlPrefix}/${req.file.filename}`;

		return sendSuccess(res, {
			url,
			filename: req.file.filename,
			originalName: req.file.originalname,
			mimeType: req.file.mimetype,
			size: req.file.size,
		}, 201);
	} catch (err) {
		return sendError(res, err);
	}
}

/**
 * POST /api/uploads/images
 * Upload multiple images (max 10).
 */
export async function uploadImagesHandler(req: Request, res: Response) {
	try {
		const files = req.files as Express.Multer.File[] | undefined;
		if (!files || files.length === 0) {
			return sendError(res, 'No files uploaded', 400, ErrorCodes.VALIDATION_ERROR);
		}

		const config = getImageUploadConfig();
		const uploaded = files.map((file) => ({
			url: `${config.urlPrefix}/${file.filename}`,
			filename: file.filename,
			originalName: file.originalname,
			mimeType: file.mimetype,
			size: file.size,
		}));

		return sendSuccess(res, { files: uploaded }, 201);
	} catch (err) {
		return sendError(res, err);
	}
}

/**
 * POST /api/uploads/document
 * Upload a single document.
 */
export async function uploadDocumentHandler(req: Request, res: Response) {
	try {
		if (!req.file) {
			return sendError(res, 'No file uploaded', 400, ErrorCodes.VALIDATION_ERROR);
		}

		const config = getDocumentUploadConfig();
		const url = `${config.urlPrefix}/${req.file.filename}`;

		return sendSuccess(res, {
			url,
			filename: req.file.filename,
			originalName: req.file.originalname,
			mimeType: req.file.mimetype,
			size: req.file.size,
		}, 201);
	} catch (err) {
		return sendError(res, err);
	}
}

/**
 * DELETE /api/uploads/:filename
 * Delete an uploaded file.
 * SECURITY: only the file owner or admin can delete.
 */
export async function deleteFileHandler(req: Request, res: Response) {
	try {
		const filename = req.params.filename as string;
		const type = req.query.type as string | undefined; // 'images' or 'documents'

		if (!filename || !type) {
			return sendError(res, 'Filename and type are required', 400, ErrorCodes.VALIDATION_ERROR);
		}

		// SECURITY: validate filename to prevent path traversal
		if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
			return sendError(res, 'Invalid filename', 400, ErrorCodes.VALIDATION_ERROR);
		}

		const baseDir = type === 'documents'
			? getDocumentUploadConfig().uploadDir
			: getImageUploadConfig().uploadDir;

		const filePath = path.join(baseDir, filename);

		// SECURITY: ensure the resolved path is within the upload directory
		const resolvedPath = path.resolve(filePath);
		const resolvedBase = path.resolve(baseDir);
		if (!resolvedPath.startsWith(resolvedBase)) {
			return sendError(res, 'Invalid filename', 400, ErrorCodes.VALIDATION_ERROR);
		}

		deleteFile(filePath);

		return sendSuccess(res, { deleted: true });
	} catch (err) {
		return sendError(res, err);
	}
}
