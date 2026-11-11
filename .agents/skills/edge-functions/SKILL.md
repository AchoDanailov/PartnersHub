---
name: edge-functions
description: How to write, change, test, and validate Supabase Edge Functions in this repo (supabase/functions/). Use this skill whenever you create a new Edge Function, edit any file under supabase/functions/, add or move Edge Function tests, touch an Edge Function's deno.json or config.toml entry, or review Edge Function code.
---

# Edge Functions in Partners Hub

This skill holds the conventions this repo settled on for `supabase/functions/`. Each one exists so a reader can open any function and find the same things in the same places, and so CI checks every function the same way.

Only `index.ts`, `deno.json` and `README.md` are fixed. Everything else follows from what the function actually has.

### `index.ts`

- imports
- the exported handler (`handleXxx`, exported so tests can call it with a fake context)
- any wiring the export needs
- `export default { fetch: withSupabase(...) }`

If a type, helper, or constant appears above the handler, move it out.

### Types, constants and helpers: a file, then a folder

Move code out of `index.ts` into the smallest structure that holds it cleanly, and grow the structure as the function grows. The same rule applies to types, constants and helpers:

1. **None**: create no file. Don't make an empty `types.ts` or a `constants.ts` with nothing in it.
2. **One domain**: a single file at the function root: `types.ts`, `constants.ts`, `helpers.ts`.
3. **More than two items across different domains**: a folder of that name, with one file per domain, named after the domain:

   ```
   <function-name>/
     index.ts
     types/
       membership.ts        Membership, MembershipRole
       request.ts           RemovalRequest, RemovalContext
     constants/
       limits.ts            MAX_BODY_BYTES, MAX_QUERY_PARAMS
       image.ts             colours and layout numbers
     helpers/
       url.ts               destination URL validation and building
       qr-code.ts           QR rendering
   ```

Re-check the shape whenever you add code. When a single `types.ts` starts mixing domains, split it into `types/`. When a folder shrinks to one file, fold it back. The three kinds evolve independently: one function can have a `types/` folder, a single `constants.ts`, and no helpers at all.

What each kind holds:

- **Types**: types and interfaces. Derive database shapes from the generated types (`Tables<"organization_members">`, `Pick<...>`) instead of retyping columns by hand, so a schema change becomes a type error.
- **Constants**: constant values such as limits, regexes, colours, layout numbers, env variable names and asset URLs.
  - Runtime state stays in the module that owns it. 
  - Don't make a constant out of a standard value used once. `"POST"`, `"Content-Type"`, `"application/json"` and a one-off error message read better inline. Make a constant when the value is tuned, used in several places, or would be a magic value without a name.
- **Helpers**: functions the handler calls. Inside a helper module, put the exported main function first and its private helpers below it. Function declarations are hoisted, so the order doesn't matter at runtime.

### `_shared/`

`_shared/` holds code that two or more functions actually use: types, constants or helpers alike. Code used by only one function stays in that function, and moves here when a second function needs it. Organise it with the same file-then-folder rule as a function directory.

Use the helpers that already exist in `_shared/http.ts` rather than writing new ones:

## Writing the handler

- **Auth**: wrap the handler in `withSupabase<Database>({ auth: ..., errors: { detailed: false } }, handler)`.
  - `errors: { detailed: false }` makes the library's auth failures use the same flat `{ code, message }` shape as our own errors.
  - The `Database` generic types `ctx.supabase` and `ctx.supabaseAdmin`. Drop it only if the function never touches the database.
- **Errors**: return every error through `errorResponse` with an `ErrorCode`. Use 400 for bad input, 401 for no caller, 403 for an authorized caller who isn't allowed, 405 for the wrong method, 500 for our failure, and 502 for a failed upstream step. Messages are for the client, so never include a stack trace, SQL, or a key.
- **Logging**: log only error codes or names (`console.error("Member removal failed:", error.code)`), never request bodies, tokens, or user data.
- **Authorization**: check it explicitly in the function. AGENTS.md requires this.
  - Use `ctx.supabaseAdmin` only for the step that really needs it.
  - Never use `user_metadata` for authorization.
- **Input**: validate everything from the request and give the body a byte limit through `readJsonBody`. Normalise identifiers (for example, lowercase UUIDs) before comparing them.
- **Idempotency**: when a retry is likely (network failure after a write), make the operation safe to repeat and say so in the handler's doc comment.
- **Dependencies**: pin npm versions exactly in the function's `deno.json` (`"npm:@supabase/server@1.9.2"`) and import them by bare name. Test-only packages (such as `jsqr`) go in the workspace root `deno.json`, not the function's.
- **Secrets**: read them from env, keep them in ignored local `.env` files, and never commit them or put them in `web/` or `VITE_*` variables.

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
3. **Give the function's `deno.json` its own tasks** (see Tests below).
4. **Write a `README.md`** with the endpoint, request and response shapes, error codes, auth, local setup, and how to verify. Use `generate-qrcode/README.md` as the model.

## Tests

CI runs `.github/scripts/functions-task.sh`. The script finds functions by globbing `supabase/functions/*/deno.json`, skipping `_` folders. Inside each function directory it then runs `deno install`, `deno task check`, `deno task test`, and `deno task test:integration` if the function's own `deno.json` defines it. A test is therefore only run in CI if the function's `deno.json` has a task that points at it. If a function has no `check`/`test` task, Deno falls back to the workspace-root task, so every function's CI step reruns the whole suite.

Scope each function's tasks to its own test folder:

```json
"tasks": {
  "check": "deno check index.ts ../tests/my-function/",
  "test": "deno test --allow-env ../tests/my-function/"
}
```

- **Permissions**: grant only what the tests need, for example `--allow-read=./assets` for bundled files.
- **Integration tests**: if a function has any, put them in `tests/<fn>/integration/` and keep them out of the unit task. CI's integration job serves every function, exports `SUPABASE_URL`, `SUPABASE_FUNCTIONS_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` and so on, and then runs the task.
  ```json
  "test": "deno test --allow-env --ignore=../tests/my-function/integration/ ../tests/my-function/",
  "test:integration": "deno test --allow-env --allow-net ../tests/my-function/integration/"
  ```
- **Boot without secrets**: the integration job sends a plain GET to each function to check it booted and fails on `BOOT_ERROR`. A function must start without any optional local-only env variables.

Writing the tests:

- Import the code under test by relative path: `../../my-function/index.ts`, `../../_shared/http.ts`.
- Unit-test the exported handler with a fake context that holds only what the handler reads (`{ ... } as unknown as MyContext`). The fake should record calls, so a test can assert, for example, that a rejected request never reached the admin client.
- Test `app.fetch(...)` only for what `withSupabase` does (401s, the error shape), setting `SUPABASE_URL`, `SUPABASE_SECRET_KEYS` and `SUPABASE_PUBLISHABLE_KEYS` with `Deno.env.set` at the top of the file.
- Cover every status the handler can return, the input limits, and every authorization rule the handler enforces. Assert the response body shape, not just the status.
- Consume or cancel every response body (`await response.text()`). Deno's leak checker fails a test that leaves a body unread.

## Validation

After any change under `supabase/functions/`, run these and fix what they report before calling the work done.

1. **Static checks**, from `supabase/functions/`. They're fast and need no Docker.
   ```sh
   deno fmt            # formats in place; then `deno fmt --check` must pass
   deno lint
   deno task check     # root: type-checks every function and all tests
   deno task test      # root: runs every function's tests
   ```
2. **Runtime checks**, which need Docker. The Supabase CLI here talks to Docker Desktop (context `desktop-linux`). Check it first:
   ```sh
   docker --context desktop-linux info >/dev/null 2>&1 && echo up || echo down
   ```
   - **If it's down, stop and ask the user to start Docker Desktop.** Don't try to start it yourself; it's a desktop app on the user's machine. In the meantime, report that the static checks passed and the runtime checks are still pending.
   - **If it's up:**
     - Run `npx supabase status`, and `npx supabase start` if the stack is stopped.
     - If the schema changed, regenerate both type files:
       ```sh
       npx supabase gen types typescript --local --schema public > supabase/functions/_shared/database.types.ts
       npx supabase gen types typescript --local --schema public > web/src/types/database.ts
       ```
     - Serve in the background with `npx supabase functions serve` (add `--env-file supabase/functions/<fn>/.env` if the function needs local secrets). Use `curl` on the changed function to confirm it boots and returns the expected status and body for a success case and one or two error cases. Stop the server afterwards.
     - If a smoke test needs a real user, sign one up on the local stack, then delete it through the admin API afterwards.

When you report back, say which of these steps ran and which didn't. "Static checks pass, runtime check skipped because Docker Desktop is down" is a useful report; "done" is not.

## Boundaries

- Work locally. Never run `supabase functions deploy`, link, or change a hosted project unless the user asks explicitly.
- Don't make git commits or other git changes unless asked.
- Edit uncommitted migrations in place rather than adding follow-up migrations.
