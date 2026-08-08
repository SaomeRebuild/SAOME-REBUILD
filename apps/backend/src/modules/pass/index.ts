import { Hono } from 'hono';
import { passRoutes } from './routes/create';

export const passModule = new Hono();

passModule.route('/', passRoutes);

export { passRoutes };
