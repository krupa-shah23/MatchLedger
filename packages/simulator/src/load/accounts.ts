/**
 * Idempotently provision load accounts through the existing API seed paths.
 * Monetary targets use minor-unit integer strings; share targets use integer strings.
 */

export type LoadFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface LoadAccountConfig {
  baseUrl: string;
  adminToken: string;
  accountPrefix: string;
  userPrefix: string;
  traderPassword: string;
  accountCount: number;
  cashMinor: string;
  holdings: Readonly<Record<string, string>>;
  fetcher?: LoadFetch;
  wait?: (milliseconds: number) => Promise<void>;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

export interface LoadAccountResult {
  accountIds: string[];
  traders: Array<{ accountId: string; username: string; password: string }>;
  balancesVerified: boolean;
}

interface AccountList { accounts: Array<{ id: string }> }
interface BalanceResponse { cash: string; available: string }
interface PositionResponse { symbol: string; quantity: string }
interface InvariantResponse { valid: boolean }
interface LoginResponse { token: string; user: { userId: string } }

async function login(fetcher: LoadFetch, baseUrl: string, username: string, password: string): Promise<{ status: number; result?: LoginResponse }> {
  const response = await fetcher(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const text = await response.text();
  return { status: response.status, ...(response.ok ? { result: JSON.parse(text) as LoginResponse } : {}) };
}

function requirePositiveIntegerString(value: string, label: string): bigint {
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error(`${label} must be a positive integer string`);
  return BigInt(value);
}

function parseDecimalMinor(value: string): bigint {
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,2}))?$/.exec(value);
  if (!match) throw new Error(`Invalid decimal balance returned by API: ${value}`);
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
}

async function requestJson<T>(fetcher: LoadFetch, url: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetcher(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${url} returned ${response.status}: ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

async function balanceOrEmpty(fetcher: LoadFetch, url: string, token: string): Promise<BalanceResponse> {
  const response = await fetcher(url, { headers: { authorization: `Bearer ${token}` } });
  const text = await response.text();
  if (response.status === 404) return { cash: "0.00", available: "0.00" };
  if (!response.ok) throw new Error(`GET ${url} returned ${response.status}: ${text}`);
  return JSON.parse(text) as BalanceResponse;
}

/**
 * Creates the configured accounts if absent, funds cash and holdings through
 * the durable deposit endpoint, then waits for real projections and invariants.
 */
export async function seedLoadAccounts(config: LoadAccountConfig): Promise<LoadAccountResult> {
  if (!Number.isInteger(config.accountCount) || config.accountCount < 1) throw new Error("accountCount must be a positive integer");
  if (!/^[A-Za-z0-9_-]+$/.test(config.accountPrefix)) throw new Error("accountPrefix contains unsupported characters");
  if (!/^[A-Za-z0-9_-]+$/.test(config.userPrefix)) throw new Error("userPrefix contains unsupported characters");
  if (config.traderPassword.length < 8 || !config.adminToken) throw new Error("admin token and a valid trader password are required");
  const cashTarget = requirePositiveIntegerString(config.cashMinor, "cashMinor");
  const holdingTargets = Object.entries(config.holdings).map(([symbol, amount]) => {
    if (!/^[A-Z0-9._-]+$/.test(symbol)) throw new Error(`Invalid holding symbol: ${symbol}`);
    return [symbol, requirePositiveIntegerString(amount, `holdings.${symbol}`)] as const;
  });
  const fetcher = config.fetcher ?? fetch;
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const wait = config.wait ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const pollIntervalMs = config.pollIntervalMs ?? 250;
  const maxPollAttempts = config.maxPollAttempts ?? 20;
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 0 || !Number.isInteger(maxPollAttempts) || maxPollAttempts < 1) {
    throw new Error("poll settings must be non-negative interval and positive attempts");
  }

  const list = await requestJson<AccountList>(fetcher, `${baseUrl}/admin/accounts`, config.adminToken);
  const existing = new Set(list.accounts.map((account) => account.id));
  const accountIds = Array.from({ length: config.accountCount }, (_, index) => `${config.accountPrefix}-${index + 1}`);
  const traders: LoadAccountResult["traders"] = [];
  const ownerTokens = new Map<string, string>();

  for (const [index, accountId] of accountIds.entries()) {
    const username = `${config.userPrefix}-${index + 1}`;
    let owner = await login(fetcher, baseUrl, username, config.traderPassword);
    if (owner.status === 401) {
      const created = await requestJson<{ userId: string }>(fetcher, `${baseUrl}/admin/users`, config.adminToken, {
        method: "POST",
        body: JSON.stringify({ username, password: config.traderPassword, role: "TRADER" }),
      });
      owner = await login(fetcher, baseUrl, username, config.traderPassword);
      if (!owner.result || owner.result.user.userId !== created.userId) throw new Error(`Could not authenticate newly created load trader ${username}`);
    }
    if (owner.status !== 200 || !owner.result) throw new Error(`Could not authenticate load trader ${username} (HTTP ${owner.status})`);
    ownerTokens.set(accountId, owner.result.token);
    if (!existing.has(accountId)) {
      await requestJson(fetcher, `${baseUrl}/admin/accounts`, config.adminToken, {
        method: "POST",
        body: JSON.stringify({ accountId, ownerUserId: owner.result.user.userId }),
      });
    }
    const [balance, positions] = await Promise.all([
      balanceOrEmpty(fetcher, `${baseUrl}/accounts/${encodeURIComponent(accountId)}/balances`, owner.result.token),
      requestJson<PositionResponse[]>(fetcher, `${baseUrl}/accounts/${encodeURIComponent(accountId)}/positions`, owner.result.token),
    ]);
    const cashCurrent = parseDecimalMinor(balance.cash);
    if (cashCurrent < cashTarget) await fund(accountId, "CASH", (cashTarget - cashCurrent).toString());
    const currentHoldings = new Map(positions.map((position) => [position.symbol, BigInt(position.quantity)]));
    for (const [symbol, amount] of holdingTargets) {
      const current = currentHoldings.get(symbol) ?? 0n;
      if (current < amount) await fund(accountId, `SHARES:${symbol}`, (amount - current).toString());
    }
    traders.push({ accountId, username, password: config.traderPassword });
  }

  let balancesVerified = false;
  for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
    const verified = await Promise.all(accountIds.map(async (accountId) => {
      const [balance, positions] = await Promise.all([
        balanceOrEmpty(fetcher, `${baseUrl}/accounts/${encodeURIComponent(accountId)}/balances`, ownerTokens.get(accountId)!),
        requestJson<PositionResponse[]>(fetcher, `${baseUrl}/accounts/${encodeURIComponent(accountId)}/positions`, ownerTokens.get(accountId)!),
      ]);
      const bySymbol = new Map(positions.map((position) => [position.symbol, BigInt(position.quantity)]));
      return parseDecimalMinor(balance.cash) >= cashTarget
        && holdingTargets.every(([symbol, target]) => (bySymbol.get(symbol) ?? 0n) >= target);
    }));
    if (verified.every(Boolean)) {
      const invariant = await requestJson<InvariantResponse>(fetcher, `${baseUrl}/system/invariants`, config.adminToken);
      if (!invariant.valid) throw new Error("System invariants are not valid after load-account seeding");
      balancesVerified = true;
      break;
    }
    if (attempt + 1 < maxPollAttempts) await wait(pollIntervalMs);
  }
  if (!balancesVerified) throw new Error("Load account funding did not appear in real balance and position projections before the poll limit");
  return { accountIds, traders, balancesVerified };

  async function fund(accountId: string, asset: string, target: string): Promise<void> {
    await requestJson(fetcher, `${baseUrl}/admin/accounts/${encodeURIComponent(accountId)}/deposit`, config.adminToken, {
      method: "POST",
      body: JSON.stringify({ requestId: `load-seed:${accountId}:${asset}:${target}`, asset, amount: target }),
    });
  }
}
