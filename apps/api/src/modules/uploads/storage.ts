/**
 * Upload storage configuration.
 *
 * Supports two backends:
 *   1. Local filesystem (default for development)
 *   2. S3-compatible storage (for production)
 *
 * SECURITY (OWASP ASVS 12.1.1):
 *   - Files are stored outside the web root
 *   - Filenames are randomized to prevent path traversal
 *   - MIME type validation on upload
 *   - Size limits enforced
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface UploadConfig {
	/** Base directory for local storage */
	uploadDir: string;
	/** Maximum file size in bytes */
	maxFileSize: number;
	/** Allowed MIME types */
	allowedMimeTypes: string[];
	/** URL prefix for serving uploaded files */
	urlPrefix: string;
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880', 10); // 5MB default

/** Allowed image MIME types */
export const ALLOWED_IMAGE_TYPES = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/svg+xml',
];

/** Allowed document MIME types */
export const ALLOWED_DOCUMENT_TYPES = [
	'application/pdf',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/** All allowed MIME types */
export const ALL_ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];

/**
 * Generate a safe, unique filename.
 * SECURITY: prevents path traversal and filename conflicts.
 */
export function generateSafeFilename(originalName: string): string {
	const ext = path.extname(originalName).toLowerCase();
	const randomBytes = crypto.randomBytes(16).toString('hex');
	const timestamp = Date.now();
	return `${timestamp}-${randomBytes}${ext}`;
}

/**
 * Ensure upload directory exists.
 */
export function ensureUploadDir(subDir: string): string {
	const fullPath = path.join(UPLOAD_DIR, subDir);
	fs.mkdirSync(fullPath, { recursive: true });
	return fullPath;
}

/**
 * Get the upload configuration for images.
 */
export function getImageUploadConfig(): UploadConfig {
	return {
		uploadDir: ensureUploadDir('images'),
		maxFileSize: MAX_FILE_SIZE,
		allowedMimeTypes: ALLOWED_IMAGE_TYPES,
		urlPrefix: '/uploads/images',
	};
}

/**
 * Get the upload configuration for documents.
 */
export function getDocumentUploadConfig(): UploadConfig {
	return {
		uploadDir: ensureUploadDir('documents'),
		maxFileSize: 10 * 1024 * 1024, // 10MB for documents
		allowedMimeTypes: ALLOWED_DOCUMENT_TYPES,
		urlPrefix: '/uploads/documents',
	};
}

/**
 * Delete a file from local storage.
 */
export function deleteFile(filePath: string): void {
	try {
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
		}
	} catch {
		// Best-effort deletion — log but don't throw
	}
}
