/**
 * UI-specific Zod schemas for request/response validation.
 * These are used by web/src/api/client.ts for type safety.
 */

import { z } from "zod";

// Base schemas
const roleSchema = z.enum(["TRADER", "RISK", "OPS", "ADMIN"]);
const moneySchema = z.string().regex(/^\d+$/); // Decimal string representation
const quantitySchema = z.string().regex(/^\d+$/);

// Auth schemas
export const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    role: roleSchema,
  }),
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const registerRequestSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  role: roleSchema.default("TRADER"),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const registerResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: roleSchema,
});
export type RegisterResponse = z.infer<typeof registerResponseSchema>;

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: roleSchema,
});
export type User = z.infer<typeof userSchema>;

// Order schemas
export const orderRequestSchema = z.object({
  symbol: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  quantity: quantitySchema,
  priceCapOrFloor: moneySchema.optional(),
});
export type OrderRequest = z.infer<typeof orderRequestSchema>;

export const orderStatusSchema = z.enum(["PENDING_ACK", "ACCEPTED", "FILLED", "PARTIALLY_FILLED", "CANCELLED", "REJECTED"]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  clientOrderId: z.string(),
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  quantity: quantitySchema,
  quantityFilled: quantitySchema,
  priceCapOrFloor: moneySchema.optional(),
  effectivePrice: moneySchema.optional(),
  status: orderStatusSchema,
  reservationId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Order = z.infer<typeof orderSchema>;

export const orderAcceptedResponseSchema = z.object({
  orderId: z.string(),
  status: z.literal("RECEIVED"),
});
export type OrderAcceptedResponse = z.infer<typeof orderAcceptedResponseSchema>;

export const cancelAcceptedResponseSchema = z.object({
  orderId: z.string(),
  status: z.literal("CANCEL_REQUESTED"),
});
export type CancelAcceptedResponse = z.infer<typeof cancelAcceptedResponseSchema>;

export const amendRequestSchema = z.object({
  quantity: quantitySchema.optional(),
  priceCapOrFloor: moneySchema.optional(),
});
export type AmendRequest = z.infer<typeof amendRequestSchema>;

export const amendAcceptedResponseSchema = z.object({
  orderId: z.string(),
  status: z.literal("AMEND_REQUESTED"),
});
export type AmendAcceptedResponse = z.infer<typeof amendAcceptedResponseSchema>;

export const paginatedOrdersSchema = z.object({
  orders: z.array(orderSchema),
  total: z.number().int(),
  hasMore: z.boolean(),
  cursor: z.string().optional(),
});
export type PaginatedOrders = z.infer<typeof paginatedOrdersSchema>;

export const orderEventSchema = z.object({
  type: z.string(),
  timestamp: z.string().datetime(),
  description: z.string(),
});
export type OrderEvent = z.infer<typeof orderEventSchema>;

export const orderEventsSchema = z.array(orderEventSchema);
export type OrderEvents = z.infer<typeof orderEventsSchema>;

// Error schemas
export const errorResponseSchema = z.object({
  error: z.string(),
  details: z.record(z.string(), z.string()).optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const validationErrorSchema = z.object({
  error: z.literal("Validation error"),
  details: z.record(z.string(), z.array(z.string())),
});
export type ValidationError = z.infer<typeof validationErrorSchema>;

// Instrument schemas
export const instrumentSchema = z.object({
  symbol: z.string(),
  displayName: z.string(),
  minQuantity: quantitySchema,
  maxQuantity: quantitySchema,
  tickSize: moneySchema,
});
export type Instrument = z.infer<typeof instrumentSchema>;

export const paginatedInstrumentsSchema = z.object({
  instruments: z.array(instrumentSchema),
  total: z.number().int(),
  cursor: z.string().optional(),
});
export type PaginatedInstruments = z.infer<typeof paginatedInstrumentsSchema>;

// Market data schemas
export const marketDepthSchema = z.object({
  bids: z.array(z.tuple([moneySchema, quantitySchema])),
  asks: z.array(z.tuple([moneySchema, quantitySchema])),
});
export type MarketDepth = z.infer<typeof marketDepthSchema>;

export const lastTradeSchema = z.object({
  price: moneySchema,
  quantity: quantitySchema,
  timestamp: z.string().datetime(),
});
export type LastTrade = z.infer<typeof lastTradeSchema>;

export const marketDataSchema = z.object({
  symbol: z.string(),
  depth: marketDepthSchema,
  lastTrade: lastTradeSchema.nullable(),
  midPrice: moneySchema,
});
export type MarketData = z.infer<typeof marketDataSchema>;
