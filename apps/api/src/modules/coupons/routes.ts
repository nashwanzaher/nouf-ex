import { Router } from 'express';
import { attachCouponsRoutes } from './controller.ts';

export const couponsRouter = Router();
attachCouponsRoutes(couponsRouter);