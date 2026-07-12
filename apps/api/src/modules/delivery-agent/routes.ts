import { Router } from 'express';
import { attachDeliveryAgentRoutes } from './controller.ts';

export const deliveryAgentRouter = Router();
attachDeliveryAgentRoutes(deliveryAgentRouter);