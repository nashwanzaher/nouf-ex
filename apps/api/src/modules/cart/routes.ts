import { Router } from 'express';
import { attachCartRoutes } from './controller.ts';

export const cartRouter = Router();
attachCartRoutes(cartRouter);