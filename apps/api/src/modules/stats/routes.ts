import { Router } from 'express';
import { attachStatsRoutes } from './controller.ts';

export const statsRouter = Router();
attachStatsRoutes(statsRouter);