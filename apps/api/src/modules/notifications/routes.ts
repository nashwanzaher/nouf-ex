import { Router } from 'express';
import { attachNotificationsRoutes } from './controller.ts';

export const notificationsRouter = Router();
attachNotificationsRoutes(notificationsRouter);