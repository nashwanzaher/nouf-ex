import { Router } from 'express';
import { attachWishlistRoutes } from './controller.ts';

export const wishlistRouter = Router();
attachWishlistRoutes(wishlistRouter);