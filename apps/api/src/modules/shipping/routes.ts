import { Router } from 'express';
import { attachShippingRoutes } from './controller.ts';

export const shippingRouter = Router();
attachShippingRoutes(shippingRouter);