import './i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.css';
import App from './App';
import { ensureCsrfToken } from './lib/api/client';

// P0 (2026-07-12): mint a CSRF token on app boot so the first
// mutating request (login, register, etc.) has a token ready.
// `ensureCsrfToken` returns silently on failure (e.g. dev server
// offline) — the SPA will retry on the next request that needs it.
void ensureCsrfToken();

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</StrictMode>,
);
