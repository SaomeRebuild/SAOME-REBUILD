/**
 * Order Types
 * 
 * @module shared/types/order
 */

/**
 * Order status
 */
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

/**
 * Order entity
 */
export interface Order {
  id: string;
  memberId: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Order item
 */
export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

/**
 * Create order input
 */
export interface CreateOrderInput {
  memberId: string;
  items: Omit<OrderItem, 'name'>[];
}
