// Integration tests: run against the local stack started by `npx supabase start`
// (migrations + supabase/seed.sql) with the function served by
// `npx supabase functions serve`. CI exports the env variables read below.
//
// Seeded admins are the callers. Each test creates its own staff member to
// remove, so no seed rows are consumed and the file can be re-run locally.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../_shared/database.types.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const FUNCTIONS_URL = requireEnv("SUPABASE_FUNCTIONS_URL");
const PUBLISHABLE_KEY = requireEnv("SUPABASE_PUBLISHABLE_KEY");
const SECRET_KEY = requireEnv("SUPABASE_SECRET_KEY");

const ENDPOINT = `${FUNCTIONS_URL}/soft-remove-organization-member`;
const PASSWORD = "password123";
const ALPINE_ORGANIZATION_ID = "a1000000-0000-0000-0000-000000000001";
const ALPINE_ADMIN = "admin@alpine.example.com";
const HARBOR_ADMIN = "admin@harbor.example.com";

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
};
const admin = createClient<Database>(SUPABASE_URL, SECRET_KEY, clientOptions);

Deno.test("an admin soft-removes a staff member of their organization", async () => {
  const member = await createAlpineStaffMember();
  const token = await signIn(ALPINE_ADMIN);

  const response = await removeMember(member.id, token);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.userId, member.id);

  const { data: membership, error } = await admin
    .from("organization_members")
    .select("left_at")
    .eq("user_id", member.id)
    .single();
  assert.ifError(error);
  assert.ok(membership.left_at, "left_at is set");
  assert.equal(
    new Date(membership.left_at).getTime(),
    new Date(body.leftAt).getTime(),
  );

  // The Auth account is soft-deleted, so the member can no longer sign in.
  const { error: signInError } = await publishableClient().auth
    .signInWithPassword({
      email: member.email,
      password: PASSWORD,
    });
  assert.ok(signInError, "a removed member cannot sign in");
});

Deno.test("an admin of another organization is forbidden", async () => {
  const member = await createAlpineStaffMember();
  const token = await signIn(HARBOR_ADMIN);

  const response = await removeMember(member.id, token);
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.code, "FORBIDDEN");

  const { data: membership, error } = await admin
    .from("organization_members")
    .select("left_at")
    .eq("user_id", member.id)
    .single();
  assert.ifError(error);
  assert.equal(membership.left_at, null, "the membership is untouched");
});

Deno.test("a request without a user JWT is rejected", async () => {
  const response = await removeMember(crypto.randomUUID(), null);
  await response.body?.cancel();

  assert.equal(response.status, 401);
});

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(
      `${name} is not set. Start the local stack and export its values (see the edge-functions skill).`,
    );
  }
  return value;
}

function publishableClient() {
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, clientOptions);
}

async function signIn(email: string): Promise<string> {
  const { data, error } = await publishableClient().auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  assert.ifError(error);
  return data.session.access_token;
}

/** Creates a confirmed Auth user with a profile and a staff membership in Alpine Wellness. */
async function createAlpineStaffMember(): Promise<
  { id: string; email: string }
> {
  const email = `integration-${crypto.randomUUID()}@alpine.example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  assert.ifError(error);
  const id = data.user.id;

  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id, username: `integration-${id}` });
  assert.ifError(profileError);

  const { error: membershipError } = await admin
    .from("organization_members")
    .insert({
      user_id: id,
      organization_id: ALPINE_ORGANIZATION_ID,
      role: "staff",
    });
  assert.ifError(membershipError);

  return { id, email };
}

function removeMember(userId: string, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    apikey: PUBLISHABLE_KEY,
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ userId }),
  });
}
