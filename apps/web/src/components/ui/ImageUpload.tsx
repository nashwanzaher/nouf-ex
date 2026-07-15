/**
 * ImageUpload component — drag-and-drop image upload with preview.
 *
 * SECURITY (OWASP ASVS 12.1.1):
 *   - Client-side MIME type validation
 *   - File size limit enforcement
 *   - Preview before upload
 *   - Upload progress indication
 */
import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UploadedFile {
	url: string;
	filename: string;
	originalName: string;
	mimeType: string;
	size: number;
}

interface ImageUploadProps {
	/** Current value (URL or UploadedFile) */
	value?: string | UploadedFile;
	/** Callback when upload completes */
	onUpload: (file: UploadedFile) => void;
	/** Callback when file is removed */
	onRemove?: () => void;
	/** Maximum file size in bytes (default: 5MB) */
	maxSize?: number;
	/** Accepted MIME types */
	accept?: string[];
	/** Whether multiple files can be selected */
	multiple?: boolean;
	/** Custom class name */
	className?: string;
	/** Whether the upload is disabled */
	disabled?: boolean;
}

const DEFAULT_ACCEPT = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB

export function ImageUpload({
	value,
	onUpload,
	onRemove,
	maxSize = DEFAULT_MAX_SIZE,
	accept = DEFAULT_ACCEPT,
	multiple = false,
	className,
	disabled = false,
}: ImageUploadProps) {
	const { t } = useTranslation();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [preview, setPreview] = useState<string | null>(
		typeof value === 'string' ? value : value?.url ?? null
	);

	const validateFile = useCallback(
		(file: File): string | null => {
			if (!accept.includes(file.type)) {
				return t('upload.invalidType', 'Invalid file type. Allowed: {{types}}', {
					types: accept.map((t) => t.split('/')[1]).join(', '),
				});
			}
			if (file.size > maxSize) {
				return t('upload.tooLarge', 'File too large. Maximum size: {{size}}MB', {
					size: Math.round(maxSize / 1024 / 1024),
				});
			}
			return null;
		},
		[accept, maxSize, t]
	);

	const uploadFile = useCallback(
		async (file: File) => {
			setIsUploading(true);
			setError(null);

			try {
				const formData = new FormData();
				formData.append('image', file);

				const response = await fetch('/api/uploads/image', {
					method: 'POST',
					body: formData,
					credentials: 'include',
				});

				if (!response.ok) {
					const data = await response.json();
					throw new Error(data.error || 'Upload failed');
				}

				const data = await response.json();
				const uploaded: UploadedFile = data.data;
				setPreview(uploaded.url);
				onUpload(uploaded);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Upload failed');
			} finally {
				setIsUploading(false);
			}
		},
		[onUpload]
	);

	const handleFileSelect = useCallback(
		async (files: FileList | null) => {
			if (!files || files.length === 0) return;

			const file = files[0];
			const validationError = validateFile(file);
			if (validationError) {
				setError(validationError);
				return;
			}

			// Create preview
			const reader = new FileReader();
			reader.onload = (e) => {
				setPreview(e.target?.result as string);
			};
			reader.readAsDataURL(file);

			// Upload file
			await uploadFile(file);
		},
		[validateFile, uploadFile]
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			handleFileSelect(e.dataTransfer.files);
		},
		[handleFileSelect]
	);

	const handleClick = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handleRemove = useCallback(() => {
		setPreview(null);
		setError(null);
		onRemove?.();
	}, [onRemove]);

	return (
		<div className={cn('relative', className)}>
			<input
				ref={fileInputRef}
				type="file"
				accept={accept.join(',')}
				multiple={multiple}
				onChange={(e) => handleFileSelect(e.target.files)}
				className="hidden"
				disabled={disabled}
			/>

			{preview ? (
				<div className="relative group">
					<img
						src={preview}
						alt="Preview"
						className="w-full h-48 object-cover rounded-lg border"
					/>
					{!disabled && onRemove && (
						<button
							onClick={handleRemove}
							className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
							aria-label={t('upload.remove', 'Remove image')}
						>
							<X className="w-4 h-4" />
						</button>
					)}
					{isUploading && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
						</div>
					)}
				</div>
			) : (
				<div
					onClick={handleClick}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
					className={cn(
						'flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
						isDragging
							? 'border-primary bg-primary/5'
							: 'border-gray-300 hover:border-gray-400',
						disabled && 'opacity-50 cursor-not-allowed'
					)}
				>
					<Upload className="w-8 h-8 mb-2 text-gray-400" />
					<p className="text-sm text-gray-500">
						{t('upload.dragDrop', 'Drag and drop an image, or click to select')}
					</p>
					<p className="text-xs text-gray-400 mt-1">
						{t('upload.maxSize', 'Max size: {{size}}MB', {
							size: Math.round(maxSize / 1024 / 1024),
						})}
					</p>
				</div>
			)}

			{error && (
				<p className="mt-2 text-sm text-red-500">{error}</p>
			)}
		</div>
	);
}

/**
 * MultipleImageUpload — upload multiple images with preview grid.
 */
interface MultipleImageUploadProps {
	/** Current values */
	value?: UploadedFile[];
	/** Callback when upload completes */
	onUpload: (files: UploadedFile[]) => void;
	/** Callback when a file is removed */
	onRemove?: (index: number) => void;
	/** Maximum number of files */
	maxFiles?: number;
	/** Custom class name */
	className?: string;
	/** Whether the upload is disabled */
	disabled?: boolean;
}

export function MultipleImageUpload({
	value = [],
	onUpload,
	onRemove,
	maxFiles = 10,
	className,
	disabled = false,
}: MultipleImageUploadProps) {
	const { t } = useTranslation();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleFileSelect = useCallback(
		async (files: FileList | null) => {
			if (!files || files.length === 0) return;

			const remainingSlots = maxFiles - value.length;
			if (files.length > remainingSlots) {
				setError(
					t('upload.tooMany', 'Too many files. Maximum: {{max}}', { max: maxFiles })
				);
				return;
			}

			setIsUploading(true);
			setError(null);

			try {
				const formData = new FormData();
				Array.from(files).forEach((file) => {
					formData.append('images', file);
				});

				const response = await fetch('/api/uploads/images', {
					method: 'POST',
					body: formData,
					credentials: 'include',
				});

				if (!response.ok) {
					const data = await response.json();
					throw new Error(data.error || 'Upload failed');
				}

				const data = await response.json();
				onUpload(data.data.files);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Upload failed');
			} finally {
				setIsUploading(false);
			}
		},
		[maxFiles, value.length, onUpload, t]
	);

	return (
		<div className={className}>
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
				{value.map((file, index) => (
					<div key={file.filename} className="relative group">
						<img
							src={file.url}
							alt={file.originalName}
							className="w-full h-32 object-cover rounded-lg border"
						/>
						{!disabled && onRemove && (
							<button
								onClick={() => onRemove(index)}
								className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
								aria-label={t('upload.remove', 'Remove image')}
							>
								<X className="w-4 h-4" />
							</button>
						)}
					</div>
				))}

				{value.length < maxFiles && !disabled && (
					<div
						onClick={() => fileInputRef.current?.click()}
						className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer border-gray-300 hover:border-gray-400 transition-colors"
					>
						{isUploading ? (
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
						) : (
							<>
								<ImageIcon className="w-8 h-8 mb-2 text-gray-400" />
								<p className="text-xs text-gray-500">
									{t('upload.addMore', 'Add more')}
								</p>
							</>
						)}
					</div>
				)}
			</div>

			<input
				ref={fileInputRef}
				type="file"
				accept={DEFAULT_ACCEPT.join(',')}
				multiple
				onChange={(e) => handleFileSelect(e.target.files)}
				className="hidden"
				disabled={disabled}
			/>

			{error && (
				<p className="mt-2 text-sm text-red-500">{error}</p>
			)}
		</div>
	);
}
