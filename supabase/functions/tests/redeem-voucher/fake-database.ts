// An in-memory stand-in for the two Supabase clients the handler uses. It
// supports only the query shapes the handler builds, and records each query.
import type { RedeemContext } from "../../redeem-voucher/types/context.ts";

export interface FakeVoucher {
  id: string;
  service_id: string;
  status: "active" | "redeemed" | "cancelled";
  expires_on: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
  qr_token: string;
  redemption_code: string;
  services: { name: string; organization_id: string };
}

export interface FakeQuery {
  table: string;
  kind: "select" | "count" | "update" | "insert";
  filters: Record<string, unknown>;
  values?: Record<string, unknown>;
}

export interface FakeOptions {
  userId?: string | null;
  membership?: { organization_id: string; left_at: string | null } | null;
  membershipError?: { code: string };
  failedAttempts?: number;
  attemptsError?: { code: string };
  vouchers?: FakeVoucher[];
  lookupError?: { code: string };
  updateError?: { code: string };
  /** Runs right before the update, to simulate another request winning a race. */
  beforeUpdate?: (vouchers: FakeVoucher[]) => void;
}

type Result = Record<string, unknown>;

export function createFakeContext(options: FakeOptions) {
  const queries: FakeQuery[] = [];
  const vouchers = options.vouchers ?? [];

  const matches = (voucher: FakeVoucher, filters: Record<string, unknown>) =>
    Object.entries(filters).every(([key, value]) =>
      key.endsWith(">=")
        ? String(voucher[key.slice(0, -2) as keyof FakeVoucher]) >=
          String(value)
        : voucher[key as keyof FakeVoucher] === value
    );

  const view = (voucher: FakeVoucher) => {
    const { qr_token: _qr, redemption_code: _code, ...row } = voucher;
    return structuredClone(row);
  };

  function resolve(query: FakeQuery): Result {
    queries.push(query);
    if (query.table === "organization_members") {
      if (options.membershipError) {
        return { data: null, error: options.membershipError };
      }
      return { data: options.membership ?? null, error: null };
    }
    if (query.table === "voucher_code_attempts") {
      if (query.kind === "insert") return { error: null };
      if (options.attemptsError) {
        return { count: null, error: options.attemptsError };
      }
      return { count: options.failedAttempts ?? 0, error: null };
    }
    if (query.kind === "update") {
      options.beforeUpdate?.(vouchers);
      if (options.updateError) {
        return { data: null, error: options.updateError };
      }
      const voucher = vouchers.find((row) => matches(row, query.filters));
      if (!voucher) return { data: null, error: null };
      Object.assign(voucher, query.values);
      return { data: view(voucher), error: null };
    }
    if (options.lookupError) return { data: null, error: options.lookupError };
    const voucher = vouchers.find((row) => matches(row, query.filters));
    return { data: voucher ? view(voucher) : null, error: null };
  }

  function from(table: string) {
    const query: FakeQuery = { table, kind: "select", filters: {} };
    const builder = {
      select(_columns?: string, opts?: { head?: boolean }) {
        if (query.kind === "select" && opts?.head) query.kind = "count";
        return builder;
      },
      update(values: Record<string, unknown>) {
        query.kind = "update";
        query.values = values;
        return builder;
      },
      insert(values: Record<string, unknown>) {
        query.kind = "insert";
        query.values = values;
        return Promise.resolve(resolve(query));
      },
      eq(column: string, value: unknown) {
        query.filters[column] = value;
        return builder;
      },
      gte(column: string, value: unknown) {
        query.filters[`${column}>=`] = value;
        return builder;
      },
      maybeSingle() {
        return Promise.resolve(resolve(query));
      },
      then(
        onFulfilled: (value: Result) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) {
        return Promise.resolve(resolve(query)).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  const userId = options.userId === undefined
    ? "a2000000-0000-0000-0000-000000000002"
    : options.userId;
  const ctx = {
    userClaims: userId ? { id: userId } : null,
    // The user client is only used for the caller's membership.
    supabase: {
      from: (table: string) => {
        if (table !== "organization_members") {
          throw new Error(`The user client must not read ${table}.`);
        }
        return from(table);
      },
    },
    supabaseAdmin: { from },
  } as unknown as RedeemContext;

  return { ctx, queries, vouchers };
}
