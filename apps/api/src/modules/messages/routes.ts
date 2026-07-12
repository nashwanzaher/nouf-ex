import { Router } from 'express';
import { attachMessagesRoutes } from './controller.ts';

export const messagesRouter = Router();
attachMessagesRoutes(messagesRouter);