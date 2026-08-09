import { Hono } from 'hono';
import { passRoutes } from './routes/create';
import { confirmPaymentRoute } from './routes/confirmPayment';

export const passModule = new Hono();

passModule.route('/', passRoutes);
passModule.route('/confirm-payment', confirmPaymentRoute);

export { passRoutes };
