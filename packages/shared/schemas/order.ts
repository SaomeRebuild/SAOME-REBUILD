/**
 * Order Schemas
 * 
 * @module shared/schemas/order
 */

import { z } from 'zod';

export const orderStatusSchema = z.enum(['pending', 'paid', 'shipped', 'delivered', 'cancelled']);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
});

export const createOrderSchema = z.object({
  memberId: z.string(),
  items: z.array(orderItemSchema).min(1),
});

export type OrderItem = z.infer<typeof orderItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
