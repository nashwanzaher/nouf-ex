/**
 * Auth module router — thin wiring between HTTP and controller.
 */
import { Router } from 'express';
import { attachAuthRoutes } from './controller.ts';

export const authRouter = Router();
attachAuthRoutes(authRouter);
