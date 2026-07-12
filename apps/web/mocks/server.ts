/**
 * mocks/server.ts — MSW server lifecycle.
 *
 * Usage in a test file:
 *
 *   import { server } from '../mocks/server';
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 *   afterAll(() => server.close());
 *
 * Or wrap an entire test file in a `describeWithServer()` helper.
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
