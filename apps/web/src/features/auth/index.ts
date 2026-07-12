/**
 * Auth feature public surface.
 *
 * Prefer importing from subpaths in real code; this barrel is kept
 * for convenience during the migration.
 */
export { default as AuthLayout } from './components/AuthLayout';
export { default as Login } from './components/Login';
export { default as Register } from './components/Register';
export { default as ForgotPassword } from './components/ForgotPassword';
export { default as ResetPassword } from './components/ResetPassword';

export {
	changePassword,
	disable2FA,
	enable2FA,
	forgotPassword,
	getCurrentUser,
	login,
	regenerateBackupCodes,
	register,
	resetPassword,
	setup2FA,
	updateProfile,
	verify2FA,
	 type AuthLoginResult,
	 type ForgotPasswordResult,
} from './api/auth';
