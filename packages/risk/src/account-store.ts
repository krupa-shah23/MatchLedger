// PROTOTYPE (Week 4). Replaced by the real reservation stage in Week 7.

import { UnknownAccountError } from "./errors.js";
import type { AccountState } from "./types.js";

export class AsyncAccountStore {
  private readonly accounts: Map<string, AccountState>;
  private failure: { readonly call: number; readonly error: unknown } | undefined;
  public readCount = 0;
  public writeCount = 0;

  public constructor(
    initial: ReadonlyMap<string, AccountState>,
    private readonly delay: () => Promise<void>,
  ) {
    this.accounts = new Map();
    for (const [accountId, state] of initial) this.accounts.set(accountId, { ...state });
  }

  public async read(accountId: string): Promise<AccountState> {
    await this.delay();
    const state = this.accounts.get(accountId);
    if (state === undefined) throw new UnknownAccountError(accountId);
    this.readCount += 1;
    return { ...state };
  }

  public async write(accountId: string, state: AccountState): Promise<void> {
    await this.delay();
    const existing = this.accounts.get(accountId);
    if (existing === undefined) throw new UnknownAccountError(accountId);
    this.writeCount += 1;
    const call = this.writeCount;
    if (this.failure?.call === call) {
      const error = this.failure.error;
      this.failure = undefined;
      throw error;
    }
    this.accounts.set(accountId, { ...state });
  }

  public peek(accountId: string): AccountState {
    const state = this.accounts.get(accountId);
    if (state === undefined) throw new UnknownAccountError(accountId);
    return { ...state };
  }

  public failWriteOnCall(call: number, error: unknown): void {
    this.failure = { call, error };
  }
}
