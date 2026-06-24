import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export interface Toast {
	id: string;
	message: string;
	type: 'success' | 'error' | 'warning' | 'info';
}

const icons = {
	success: CheckCircle,
	error: AlertCircle,
	warning: AlertTriangle,
	info: Info,
};

const colors = {
	success: 'bg-green-50 text-green-800 border-green-200',
	error: 'bg-red-50 text-red-800 border-red-200',
	warning: 'bg-amber-50 text-amber-800 border-amber-200',
	info: 'bg-blue-50 text-blue-800 border-blue-200',
};

const iconColors = {
	success: 'text-green-500',
	error: 'text-red-500',
	warning: 'text-amber-500',
	info: 'text-blue-500',
};

interface ToastContainerProps {
	toasts: Toast[];
	onRemove: (id: string) => void;
}

export default function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
	return (
		<div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90vw] max-w-md pointer-events-none">
			<AnimatePresence>
				{toasts.map((toast) => {
					const Icon = icons[toast.type];
					return (
						<motion.div
							key={toast.id}
							initial={{ opacity: 0, y: -20, scale: 0.95 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: -20, scale: 0.95 }}
							className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${colors[toast.type]}`}
						>
							<Icon size={18} className={iconColors[toast.type]} />
							<span className="text-sm font-medium flex-1">{toast.message}</span>
							<button
								onClick={() => onRemove(toast.id)}
								className="p-1 rounded-lg hover:bg-black/5 transition-colors"
							>
								<X size={14} />
							</button>
						</motion.div>
					);
				})}
			</AnimatePresence>
		</div>
	);
}
