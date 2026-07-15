// =============================================================================
// Email channel — minimal SMTP client (no external deps)
// =============================================================================
// Activates when SMTP_HOST is set. Speaks the minimum SMTP needed to
// submit a message (EHLO / STARTTLS or implicit TLS / AUTH PLAIN /
// MAIL FROM / RCPT TO / DATA / QUIT). Supports:
//   - SMTP_HOST, SMTP_PORT (default 587 for STARTTLS, 465 for SMTPS)
//   - SMTP_USER, SMTP_PASSWORD
//   - SMTP_FROM (e.g. "Noufex <no-reply@Noufex.com>")
//   - SMTP_SECURE ("true" to use implicit TLS on port 465)
//
// When unconfigured the channel reports ok=false with a clear reason
// so the dispatcher can fall through to in_app logging.
// =============================================================================
import { connect, type Socket } from 'net';
import { connect as tlsConnect, type TLSSocket } from 'tls';

function isConfigured(): boolean {
	return !!process.env.SMTP_HOST && !!process.env.SMTP_FROM;
}

function buildMime(opts: { from: string; to: string; subject: string; text: string }): string {
	const headers = [
		`From: ${opts.from}`,
		`To: ${opts.to}`,
		`Subject: =?UTF-8?B?${Buffer.from(opts.subject, 'utf8').toString('base64')}?=`,
		`MIME-Version: 1.0`,
		`Content-Type: text/plain; charset=UTF-8`,
		`Content-Transfer-Encoding: base64`,
		`Date: ${new Date().toUTCString()}`,
	].join('\r\n');
	const body = Buffer.from(opts.text, 'utf8').toString('base64');
	return `${headers}\r\n\r\n${body}\r\n`;
}

async function smtpSend(opts: {
	host: string;
	port: number;
	secure: boolean;
	user: string | null;
	password: string | null;
	from: string;
	to: string;
	mail: string;
}): Promise<string> {
	let sock: Socket = opts.secure
		? await new Promise((resolve, reject) => {
				const s = tlsConnect({ host: opts.host, port: opts.port });
				s.once('secureConnect', () => resolve(s));
				s.once('error', reject);
			})
		: await new Promise((resolve, reject) => {
				const s = connect({ host: opts.host, port: opts.port });
				s.once('connect', () => resolve(s));
				s.once('error', reject);
			});
	const read = (): Promise<string> =>
		new Promise((resolve, reject) => {
			const chunks: Buffer[] = [];
			const onData = (b: Buffer) => chunks.push(b);
			const timer = setTimeout(() => {
				sock.off('data', onData);
				reject(new Error('SMTP read timeout'));
			}, 10_000);
			sock.on('data', (b) => {
				onData(b);
				// Multi-line SMTP responses end with a space after the code.
				const s = Buffer.concat(chunks).toString('utf8');
				if (/^\d{3} /m.test(s)) {
					clearTimeout(timer);
					sock.off('data', onData);
					resolve(s);
				}
			});
		});
	const write = (line: string) =>
		new Promise<void>((resolve) => {
			sock.write(line.endsWith('\r\n') ? line : `${line}\r\n`);
			resolve();
		});
	const expect = (prefix: string) =>
		read().then((resp) => {
			if (!resp.startsWith(prefix)) {
				sock.destroy();
				throw new Error(`SMTP expected ${prefix}, got: ${resp.trim()}`);
			}
			return resp;
		});
	/** Upgrade a plain TCP socket to TLS in-place. Returns the new
	 *  TLSSocket that replaces `sock` for all subsequent reads/writes. */
	const upgradeToTls = (plain: Socket): Promise<TLSSocket> =>
		new Promise((resolve, reject) => {
			const tlsSock = tlsConnect({ socket: plain, servername: opts.host, rejectUnauthorized: true }, () => {
				resolve(tlsSock);
			});
			tlsSock.once('error', reject);
		});
	try {
		await expect('220');
		await write(`EHLO Noufex.local`);
		const ehlo = await expect('250');
		const supportsStartTls = /\bSTARTTLS\b/m.test(ehlo) && !opts.secure;
		if (supportsStartTls) {
			await write('STARTTLS');
			await expect('220');
			// Upgrade the plain socket to TLS in-place.
			sock = await upgradeToTls(sock);
			// Re-issue EHLO over the encrypted channel.
			await write(`EHLO Noufex.local`);
			await expect('250');
		}
		if (opts.user && opts.password) {
			await write('AUTH PLAIN');
			await expect('334');
			const authString = Buffer.from(`\0${opts.user}\0${opts.password}`).toString('base64');
			await write(authString);
			await expect('235');
		}
		await write(`MAIL FROM:<${opts.from}>`);
		await expect('250');
		await write(`RCPT TO:<${opts.to}>`);
		await expect('250');
		await write('DATA');
		await expect('354');
		await write(`${opts.mail}\r\n.`);
		const dataResp = await expect('250');
		await write('QUIT');
		sock.end();
		// Extract message-id from server reply if present, else synthesize.
		const id = dataResp.match(/250[^"]*"?<[^>]+>/)?.[0] ?? `local-${Date.now()}`;
		return id;
	} catch (err) {
		sock.destroy();
		throw err;
	}
}

import type {
	DispatchContext,
	DispatchResult,
	NotificationChannel,
	NotificationRow,
} from './types.ts';

export const emailChannel: NotificationChannel = {
	name: 'email',
	isConfigured: isConfigured(),
	shouldDeliver(notification: NotificationRow): boolean {
		// Don't email low-signal events; the in-app inbox covers them.
		// We DO email transactional events: order, refund, dispute,
		// review replies, system (password reset etc.), and promos only
		// when the user opted in (caller decides via user.preferred_language
		// and the `data.opt_in_promo` flag).
		const transactional = new Set([
			'order',
			'refund',
			'dispute',
			'review',
			'system',
			'message',
		]);
		if (transactional.has(notification.type)) return true;
		if (notification.type === 'promo') {
			return Boolean((notification.data as { opt_in_promo?: boolean } | null)?.opt_in_promo);
		}
		return false;
	},
	async send(ctx: DispatchContext): Promise<DispatchResult> {
		if (!ctx.user.email) {
			return {
				channel: 'email',
				ok: false,
				providerMessageId: null,
				error: 'user has no email',
			};
		}
		const host = process.env.SMTP_HOST!;
		const port = Number(
			process.env.SMTP_PORT || (process.env.SMTP_SECURE === 'true' ? 465 : 587),
		);
		const secure = process.env.SMTP_SECURE === 'true';
		const from = process.env.SMTP_FROM!;
		const mail = buildMime({
			from,
			to: ctx.user.email,
			subject: ctx.notification.title,
			text: ctx.notification.body ?? '(no body)',
		});
		try {
			const id = await smtpSend({
				host,
				port,
				secure,
				user: process.env.SMTP_USER || null,
				password: process.env.SMTP_PASSWORD || null,
				from,
				to: ctx.user.email,
				mail,
			});
			return { channel: 'email', ok: true, providerMessageId: id, error: null };
		} catch (err) {
			return {
				channel: 'email',
				ok: false,
				providerMessageId: null,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	},
};
