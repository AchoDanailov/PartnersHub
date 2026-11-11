import assert from "node:assert/strict";
import app, {
  handleRemoveOrganizationMember,
} from "../../soft-remove-organization-member/index.ts";
import type { RemovalContext } from "../../soft-remove-organization-member/types.ts";

const ACTOR_ID = "21000000-0000-0000-0000-000000000001";
const USER_ID = "21000000-0000-0000-0000-000000000002";
const LEFT_AT = "2026-11-03T12:00:00+00:00";
const ORGANIZATION_ID = "11000000-0000-0000-0000-000000000001";

const ACTOR = {
  user_id: ACTOR_ID,
  organization_id: ORGANIZATION_ID,
  role: "admin",
  left_at: null,
};
const TARGET = {
  user_id: USER_ID,
  organization_id: ORGANIZATION_ID,
  role: "staff",
  left_at: null,
};

Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
Deno.env.set(
  "SUPABASE_SECRET_KEYS",
  JSON.stringify({ default: "sb_secret_default_test_only" }),
);
Deno.env.set(
  "SUPABASE_PUBLISHABLE_KEYS",
  JSON.stringify({ default: "sb_publishable_default_test_only" }),
);

function createRequest(
  options: { method?: string; body?: string; contentType?: string } = {},
): Request {
  const method = options.method ?? "POST";
  return new Request(
    "http://localhost/functions/v1/soft-remove-organization-member",
    {
      method,
      headers: { "Content-Type": options.contentType ?? "application/json" },
      body: method === "GET"
        ? undefined
        : options.body ?? JSON.stringify({ userId: USER_ID }),
    },
  );
}

function createContext(options: {
  actorId?: string | null;
  members?: unknown[];
  lookupError?: { code: string };
  removalError?: { code: string };
  releaseError?: { code: string };
} = {}) {
  const calls = {
    lookups: [] as { table: string; ids: string[] }[],
    rpc: [] as { name: string; args: unknown }[],
    deleted: [] as { id: string; soft: boolean }[],
  };
  const actorId = options.actorId === undefined ? ACTOR_ID : options.actorId;

  const ctx = {
    userClaims: actorId ? { id: actorId } : null,
    // The user client can only read memberships: calling the RPC with it throws.
    supabase: {
      from: (table: string) => ({
        select: () => ({
          in: (_column: string, ids: string[]) => {
            calls.lookups.push({ table, ids });
            return Promise.resolve(
              options.lookupError
                ? { data: null, error: options.lookupError }
                : { data: options.members ?? [ACTOR, TARGET], error: null },
            );
          },
        }),
      }),
    },
    // Only the RPC and the Auth Admin API are available on the admin client.
    supabaseAdmin: {
      rpc: (name: string, args: unknown) => {
        calls.rpc.push({ name, args });
        return Promise.resolve(
          options.removalError
            ? { data: null, error: options.removalError }
            : { data: LEFT_AT, error: null },
        );
      },
      auth: {
        admin: {
          deleteUser: (id: string, soft: boolean) => {
            calls.deleted.push({ id, soft });
            return Promise.resolve({ error: options.releaseError ?? null });
          },
        },
      },
    },
  } as unknown as RemovalContext;

  return { ctx, calls };
}

Deno.test("rejects requests without a user token", async () => {
  const response = await app.fetch(createRequest());
  assert.equal(response.status, 401);
  assert.deepEqual(Object.keys(await response.json()).sort(), [
    "code",
    "message",
  ]);
});

Deno.test("returns 405 for non-POST requests", async () => {
  const { ctx, calls } = createContext();
  const response = await handleRemoveOrganizationMember(
    createRequest({ method: "GET" }),
    ctx,
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.equal(calls.rpc.length, 0);
  assert.equal((await response.json()).code, "METHOD_NOT_ALLOWED");
});

Deno.test("returns 400 for invalid bodies without touching data", async () => {
  for (
    const body of [
      "{",
      "null",
      "[]",
      "{}",
      '{"userId":1}',
      '{"userId":"not-a-uuid"}',
    ]
  ) {
    const { ctx, calls } = createContext();
    const response = await handleRemoveOrganizationMember(
      createRequest({ body }),
      ctx,
    );
    assert.equal(response.status, 400, body);
    assert.equal(calls.rpc.length, 0);
    assert.equal(calls.deleted.length, 0);
    assert.equal((await response.json()).code, "INVALID_REQUEST");
  }
});

Deno.test("returns 400 for a wrong content type or an oversized body", async () => {
  const requests = [
    createRequest({ contentType: "text/plain" }),
    createRequest({
      body: JSON.stringify({ userId: USER_ID, padding: "x".repeat(1024) }),
    }),
  ];

  for (const request of requests) {
    const { ctx, calls } = createContext();
    const response = await handleRemoveOrganizationMember(request, ctx);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "INVALID_REQUEST");
    assert.equal(calls.lookups.length, 0);
  }
});

Deno.test("returns 400 when the caller removes themselves", async () => {
  const { ctx, calls } = createContext();
  const response = await handleRemoveOrganizationMember(
    createRequest({ body: JSON.stringify({ userId: ACTOR_ID }) }),
    ctx,
  );
  assert.equal(response.status, 400);
  assert.equal(calls.rpc.length, 0);
  assert.equal((await response.json()).code, "INVALID_REQUEST");
});

Deno.test("passes the verified actor to the removal and ignores a body actor", async () => {
  const { ctx, calls } = createContext();
  const response = await handleRemoveOrganizationMember(
    createRequest({
      body: JSON.stringify({
        userId: USER_ID,
        actorId: USER_ID,
        p_actor_id: USER_ID,
      }),
    }),
    ctx,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(calls.lookups, [{
    table: "organization_members",
    ids: [ACTOR_ID, USER_ID],
  }]);
  assert.deepEqual(calls.rpc, [{
    name: "remove_organization_member",
    args: { p_actor_id: ACTOR_ID, p_user_id: USER_ID },
  }]);
  await response.text();
});

Deno.test("returns 403 without calling the removal when the actor is not authorized", async () => {
  const cases: [string, unknown[]][] = [
    ["no memberships", []],
    ["actor without a membership", [TARGET]],
    ["target not visible to the actor", [ACTOR]],
    ["staff actor", [{ ...ACTOR, role: "staff" }, TARGET]],
    ["former admin", [{ ...ACTOR, left_at: LEFT_AT }, TARGET]],
    ["target is an admin", [ACTOR, { ...TARGET, role: "admin" }]],
    ["target in another organization", [ACTOR, {
      ...TARGET,
      organization_id: "11000000-0000-0000-0000-000000000002",
    }]],
  ];

  for (const [name, members] of cases) {
    const { ctx, calls } = createContext({ members });
    const response = await handleRemoveOrganizationMember(createRequest(), ctx);
    assert.equal(response.status, 403, name);
    assert.equal(calls.rpc.length, 0, name);
    assert.equal(calls.deleted.length, 0, name);
    assert.equal((await response.json()).code, "FORBIDDEN");
  }
});

Deno.test("allows retrying the removal of a member who already left", async () => {
  const { ctx, calls } = createContext({
    members: [ACTOR, { ...TARGET, left_at: LEFT_AT }],
  });
  const response = await handleRemoveOrganizationMember(createRequest(), ctx);
  assert.equal(response.status, 200);
  assert.equal(calls.rpc.length, 1);
  assert.deepEqual(calls.deleted, [{ id: USER_ID, soft: true }]);
  await response.text();
});

Deno.test("returns 500 without calling the removal when the lookup fails", async () => {
  const { ctx, calls } = createContext({ lookupError: { code: "42501" } });
  const response = await handleRemoveOrganizationMember(createRequest(), ctx);
  assert.equal(response.status, 500);
  assert.equal(calls.rpc.length, 0);
  assert.equal(calls.deleted.length, 0);
  assert.equal((await response.json()).code, "REMOVAL_FAILED");
});

Deno.test("soft-deletes the account after a successful removal", async () => {
  const { ctx, calls } = createContext();
  const response = await handleRemoveOrganizationMember(createRequest(), ctx);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    userId: USER_ID,
    leftAt: LEFT_AT,
  });
  assert.deepEqual(calls.deleted, [{ id: USER_ID, soft: true }]);
});

Deno.test("returns 403 and keeps the account when the database denies the removal", async () => {
  const { ctx, calls } = createContext({ removalError: { code: "P0001" } });
  const response = await handleRemoveOrganizationMember(createRequest(), ctx);
  assert.equal(response.status, 403);
  assert.equal(calls.deleted.length, 0);
  assert.equal((await response.json()).code, "FORBIDDEN");
});

Deno.test("returns 500 and keeps the account on an unexpected error", async () => {
  const { ctx, calls } = createContext({ removalError: { code: "42501" } });
  const response = await handleRemoveOrganizationMember(createRequest(), ctx);
  assert.equal(response.status, 500);
  assert.equal(calls.deleted.length, 0);
  assert.equal((await response.json()).code, "REMOVAL_FAILED");
});

Deno.test("returns 502 when the email could not be released, and a retry works", async () => {
  const failed = createContext({ releaseError: { code: "unexpected" } });
  const first = await handleRemoveOrganizationMember(
    createRequest(),
    failed.ctx,
  );
  assert.equal(first.status, 502);
  assert.equal((await first.json()).code, "EMAIL_NOT_RELEASED");

  const retried = createContext();
  const second = await handleRemoveOrganizationMember(
    createRequest(),
    retried.ctx,
  );
  assert.equal(second.status, 200);
  assert.deepEqual(retried.calls.deleted, [{ id: USER_ID, soft: true }]);
  await second.text();
});
