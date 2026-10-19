import { z } from "zod";

// Auth
export const LoginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1),
});
export type Login = z.infer<typeof LoginSchema>;

export const TokenResponseSchema = z.object({
  token: z.string(),
  expiresIn: z.number(),
});
export type TokenResponse = z.infer<typeof TokenResponseSchema>;

export const MeResponseSchema = z.object({
  userId: z.string(),
  username: z.string(),
  role: z.enum(["TRADER", "RISK", "OPS", "ADMIN"]),
  accountIds: z.array(z.string()),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

// Orders
export const PlaceOrderBodySchema = z
  .object({
    clientOrderId: z.string().min(1).max(64),
    symbol: z.string().min(1).max(16),
    side: z.enum(["BUY", "SELL"]),
    type: z.enum(["LIMIT", "MARKET"]),
    timeInForce: z.enum(["GTC", "IOC"]),
    quantity: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).transform((v) => (typeof v === "string" ? BigInt(v) : BigInt(v))),
    price: z.string().optional(),
  })
  .refine(
    (o) => !(o.type === "MARKET" && o.price !== undefined),
    "MARKET orders must not have a price"
  )
  .refine(
    (o) => !(o.type === "LIMIT" && o.price === undefined),
    "LIMIT orders must have a price"
  )
  .refine(
    (o) => !(o.type === "MARKET" && o.timeInForce !== "IOC"),
    "MARKET orders must use IOC"
  );
export type PlaceOrderBody = z.infer<typeof PlaceOrderBodySchema>;

export const OrderResponseSchema = z.object({
  orderId: z.string(),
  clientOrderId: z.string(),
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["LIMIT", "MARKET"]),
  timeInForce: z.enum(["GTC", "IOC"]),
  quantity: z.string(),
  price: z.string().nullable(),
  effectivePrice: z.string().nullable(),
  status: z.enum(["RECEIVED", "ACCEPTED", "RESTING", "PARTIALLY_FILLED", "FILLED", "CANCEL_REQUESTED", "CANCELLED", "REJECTED"]),
  filledQty: z.string(),
  cancelRequested: z.boolean(),
  terminal: z.enum(["CANCELLED", "REJECTED"]).nullable(),
  terminalReason: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type OrderResponse = z.infer<typeof OrderResponseSchema>;

export const ListOrdersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(["RECEIVED", "ACCEPTED", "RESTING", "PARTIALLY_FILLED", "FILLED", "CANCEL_REQUESTED", "CANCELLED", "REJECTED"]).optional(),
  symbol: z.string().optional(),
  from: z.coerce.number().optional(),
  to: z.coerce.number().optional(),
  accountId: z.string().optional(),
});
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>;

export const PaginationSchema = z.object({
  items: z.array(z.unknown()),
  cursor: z.string().nullable(),
});
export type Pagination<T> = { items: T[]; cursor: string | null };

// Market data
export const InstrumentResponseSchema = z.object({
  symbol: z.string(),
  tick: z.string(),
  lot: z.string(),
  status: z.enum(["OPEN", "HALTED"]),
});
export type InstrumentResponse = z.infer<typeof InstrumentResponseSchema>;

export const BookLevelSchema = z.object({
  price: z.string(),
  quantity: z.string(),
});
export type BookLevel = z.infer<typeof BookLevelSchema>;

export const BookResponseSchema = z.object({
  symbol: z.string(),
  bid: z.array(BookLevelSchema),
  ask: z.array(BookLevelSchema),
  seq: z.number(),
});
export type BookResponse = z.infer<typeof BookResponseSchema>;

export const TradeSchema = z.object({
  symbol: z.string(),
  price: z.string(),
  quantity: z.string(),
  takerSide: z.enum(["BUY", "SELL"]),
  ts: z.number(),
});
export type Trade = z.infer<typeof TradeSchema>;

export const StatusResponseSchema = z.object({
  symbol: z.string(),
  breaker: z.object({
    state: z.enum(["CLOSED", "OPEN", "HALF_OPEN"]),
    tripReason: z.string().nullable(),
    incidentStartTs: z.number().nullable(),
    maxHaltDurationMs: z.number(),
  }),
});
export type StatusResponse = z.infer<typeof StatusResponseSchema>;

// Accounts
export const BalancesResponseSchema = z.object({
  accountId: z.string(),
  total: z.string(),
  held: z.string(),
  available: z.string(),
});
export type BalancesResponse = z.infer<typeof BalancesResponseSchema>;

export const PositionSchema = z.object({
  symbol: z.string(),
  quantity: z.string(),
  heldShares: z.string(),
  costBasis: z.string(),
  realizedPnl: z.string(),
  unrealizedPnl: z.string().nullable(),
});
export type Position = z.infer<typeof PositionSchema>;

export const PnlResponseSchema = z.object({
  positions: z.array(PositionSchema),
});
export type PnlResponse = z.infer<typeof PnlResponseSchema>;

export const ReservationSchema = z.object({
  orderId: z.string(),
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  asset: z.string(),
  amountTotal: z.string(),
  amountRemaining: z.string(),
  status: z.enum(["PLACED", "PARTIALLY_CONVERTED", "CONVERTED", "RELEASED"]),
  convertedAmount: z.string(),
  improvementReleased: z.string(),
  releasedReason: z.string().nullable(),
});
export type Reservation = z.infer<typeof ReservationSchema>;

export const LedgerLineSchema = z.object({
  timestamp: z.string().datetime(),
  type: z.enum(["DEBIT", "CREDIT"]),
  asset: z.string(),
  amount: z.string(),
  refEventId: z.string().nullable(),
});
export type LedgerLine = z.infer<typeof LedgerLineSchema>;

// Risk
export const HaltBodySchema = z.object({
  reason: z.string().min(1),
});
export type HaltBody = z.infer<typeof HaltBodySchema>;

export const RejectionSchema = z.object({
  id: z.string(),
  source: z.enum(["RISK", "MATCHER"]),
  orderId: z.string(),
  accountId: z.string(),
  symbol: z.string().nullable(),
  reason: z.string(),
  required: z.string().nullable(),
  snapshotJson: z.unknown().nullable(),
  ts: z.number(),
});
export type Rejection = z.infer<typeof RejectionSchema>;

export const BreakerSchema = z.object({
  symbol: z.string(),
  state: z.enum(["CLOSED", "OPEN", "HALF_OPEN"]),
  tripReason: z.string().nullable(),
  incidentStartTs: z.number().nullable(),
  stateChangeTs: z.number(),
  restingOrderCount: z.number(),
  heldFunds: z.string(),
  lastIgnored: z
    .object({
      command: z.string(),
      reason: z.string(),
      ts: z.number(),
    })
    .nullable(),
});
export type Breaker = z.infer<typeof BreakerSchema>;

// Recon
export const ResolveBodySchema = z.object({
  reason: z.string().min(1),
  adjustment: z
    .object({
      symbol: z.string().optional(),
      asset: z.string().optional(),
      amount: z.string(),
    })
    .optional(),
});
export type ResolveBody = z.infer<typeof ResolveBodySchema>;

// Admin
export const CreateUserBodySchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8),
  role: z.enum(["TRADER", "RISK", "OPS", "ADMIN"]),
});
export type CreateUserBody = z.infer<typeof CreateUserBodySchema>;

export const DepositBodySchema = z.object({
  requestId: z.string().min(1).max(64),
  asset: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
});
export type DepositBody = z.infer<typeof DepositBodySchema>;
