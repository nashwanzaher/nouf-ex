import { Router } from 'express';
import { attachAddressesRoutes } from './controller.ts';

export const addressesRouter = Router();
attachAddressesRoutes(addressesRouter);