---
name: edge-functions
description: How to write, change, test, and validate Supabase Edge Functions in this repo (supabase/functions/). Use this skill whenever you create a new Edge Function, edit any file under supabase/functions/, add or move Edge Function tests, touch an Edge Function's deno.json or config.toml entry, or review Edge Function code.
---

# Edge Functions in Partners Hub

This skill holds the conventions this repo settled on for `supabase/functions/`.

### `index.ts`

- imports
- the exported handler (`handleXxx`, exported so tests can call it with a fake context)
- any wiring the export needs
- `export default { fetch: withSupabase(...) }`

If a type, helper, or constant appears above the handler, move it out.

### Types, constants and helpers: always a folder

Put types, constants and helpers in `types/`, `constants/` and `helpers/`, with one file per domain, named after the domain (`helpers/request.ts`). Use the folder even for a single item, and create no folder for a kind the function doesn't have. This rule covers only these three kinds.

### `_shared/`

`_shared/` holds code that two or more functions actually use. Code used by only one function stays in that function, and moves here when a second function needs it. Organise it as one file per domain.

## Writing the handler

- **Auth**: wrap the handler in `withSupabase<Database>({ auth: ..., errors: { detailed: false } }, handler)`.
  - `errors: { detailed: false }` makes the library's auth failures use the same flat `{ code, message }` shape as our own errors.
  - The `Database` generic types `ctx.supabase` and `ctx.supabaseAdmin`. Drop it only if the function never touches the database.
- **Errors**: return every error through `errorResponse` with an `ErrorCode`. Use 400 for bad input, 401 for no caller, 403 for an authorized caller who isn't allowed, 405 for the wrong method, 500 for our failure, and 502 for a failed upstream step. Messages are for the client, so never include a stack trace, SQL, or a key.
- **Logging**: log only error codes or names (`console.error("Member removal failed:", error.code)`), never request bodies, tokens, or user data.
- **Authorization**: check it explicitly in the function. AGENTS.md requires this.
  - Use `ctx.supabaseAdmin` only for the step that really needs it.
  - Never use `user_metadata` for authorization.
- **Input**: validate everything from the request with a Zod schema and give the body a byte limit through `readJsonBody`. Normalise identifiers (for example, lowercase UUIDs) before comparing them.
- **Idempotency**: when a retry is likely (network failure after a write), make the operation safe to repeat. 
- **Dependencies**: pin npm versions exactly in the function's `deno.json` (`"npm:@supabase/server@1.9.2"`) and import them by bare name. Test-only packages go in the workspace root `deno.json`, not the function's.
- **Secrets**: read them from env, and never commit real ones or put them in `web/` or `VITE_*` variables. Local values live in the ignored `supabase/functions/.env`, copied from the committed `supabase/functions/.env.example`, which holds local-only values that CI also uses. Add every new variable to that example, and never use a Supabase secret key as a credential for an outside caller.

## Registering a new function

1. **Add a `config.toml` entry.** Set `verify_jwt = true` for `auth: "user"`, and `false` for `secret`, `publishable` or `none`; the `supabase-server` skill explains why. Point `import_map` at the function's own `deno.json`, because serve and deploy use that file, not the workspace root.
   ```toml
   [functions.my-function]
   enabled = true
   verify_jwt = false   # true only for auth: "user"
   import_map = "./functions/my-function/deno.json"
   entrypoint = "./functions/my-function/index.ts"
   ```
2. **Add the function to `"workspace"`** in `supabase/functions/deno.json`, and extend the root `check` task to include its `index.ts`.
3. **Put its tests in `supabase/functions/tests/<fn>/`**, which the root `check` and `test` tasks already cover (see Tests below).
4. **Write a `README.md`** with the endpoint, request and response shapes, error codes, auth, local setup, and how to verify. Use `soft-remove-organization-member/README.md` as the model. Be less verbose.

## Tests

CI runs `.github/scripts/functions-test-cmd-builder.sh` from the `supabase/functions/` workspace root: `install`, then `check`, then `test`. These run the root `check` and `test` tasks in `supabase/functions/deno.json`, so a function is only checked and tested in CI if those tasks cover its `index.ts` and `tests/<fn>/` folder.

- **Permissions**: grant only what the tests need in the root `test` task, for example `--allow-read=./my-function/assets` for bundled files.

Writing the tests:

- Import the code under test by relative path: `../../my-function/index.ts`, `../../_shared/http.ts`.
- Unit-test the exported handler with a fake context that holds only what the handler reads (`{ ... } as unknown as MyContext`). The fake should record calls, so a test can assert, for example, that a rejected request never reached the admin client.
- Test `app.fetch(...)` only for what `withSupabase` does (401s, the error shape), setting `SUPABASE_URL`, `SUPABASE_SECRET_KEYS` and `SUPABASE_PUBLISHABLE_KEYS` with `Deno.env.set` at the top of the file.
- Cover every status the handler can return, the input limits, and every authorization rule the handler enforces. Assert the response body shape, not just the status.
- Consume or cancel every response body (`await response.text()`). Deno's leak checker fails a test that leaves a body unread.

### Integration tests

Integration tests are `*.integration-tests.ts` files under `tests/<fn>/` (subfolders allowed). Run them against the live local stack from `supabase/functions/` with `deno task test:integration`. The suffix keeps them out of `test`.

- **Env**: read `SUPABASE_URL`, `SUPABASE_FUNCTIONS_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` and the variables in `supabase/functions/.env.example`. Fail with a clear message when one is missing.
- **Keep them few**, and leave edge cases to unit tests (`docs/adr/0002-integration-tests-on-ci-against-a-local-stack.md`): one per distinct integration, one per CRUD type the function performs, one allowed and one rejected caller.
- **Data**: sign in as users from `supabase/seeding/seed.sql` (password `password123`). Create any row a test changes or deletes, so the file can be re-run.
- **Empty body**: a function must reject an empty POST without side effects; CI uses it as a boot check.

## Validation

After any change under `supabase/functions/`, run everything locally and fix what it reports.

1. **Static**, from `supabase/functions/`: `deno fmt`, `deno lint`, `deno task check`, `deno task test`.
2. **Integration**, against the local stack. Needs Docker Desktop (`docker --context desktop-linux info`); if it's down, ask the user to start it. Remote agents without Docker: push the branch and read the Edge Functions workflow result instead. From the repo root:
   ```sh
   npx supabase start
   cp -n supabase/functions/.env.example supabase/functions/.env
   npx supabase functions serve --env-file supabase/functions/.env &   # background; wait until it serves
   eval "$(npx supabase status -o env)"
   export SUPABASE_URL="$API_URL" SUPABASE_FUNCTIONS_URL="$API_URL/functions/v1" \
     SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY" SUPABASE_SECRET_KEY="$SECRET_KEY"
   set -a; . supabase/functions/.env; set +a
   (cd supabase/functions && deno task test:integration)
   ```
CI (`.github/workflows/edge-functions.yml`) runs the same checks on every push. It doesn't replace running them locally.

## Boundaries

- Work locally. Never run `supabase functions deploy`, link, or change a hosted project unless the user asks explicitly.
- Don't make git commits or other git changes unless asked.
- Edit uncommitted migrations in place rather than adding follow-up migrations.
