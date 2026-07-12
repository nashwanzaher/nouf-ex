import { Router } from 'express';
import { attachStoreFollowersRoutes } from './controller.ts';

export const storeFollowersRouter = Router();
attachStoreFollowersRoutes(storeFollowersRouter);