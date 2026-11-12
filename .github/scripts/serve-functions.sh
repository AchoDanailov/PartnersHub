#!/usr/bin/env bash
# Serves every Edge Function against the running local stack and waits until each one boots.
#
# Usage: serve-functions.sh
#   Run from the repository root with the local stack running (`npx supabase start`).
#   Starts `npx supabase functions serve` in the background, then probes every function
#   listed by `functions-test-cmd-builder.sh list` with an empty POST, sent as a seeded user:
#   `Authorization: Bearer <user JWT>` plus `apikey: <publishable key>`. Functions must reject
#   that empty body without side effects; any non-5xx answer counts as booted.
#   The probe user is $PROBE_USER_EMAIL / $PROBE_USER_PASSWORD
#   (default: admin@alpine.example.com / password123 from supabase/seed.sql).
#   Fails when a function reports BOOT_ERROR/WORKER_ERROR or does not answer in time.
#   The serve log is written to $SERVE_LOG (default: ${RUNNER_TEMP:-/tmp}/functions-serve.log);
#   the server keeps running after this script exits. Stop it with `pkill -f "supabase functions serve"`.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
serve_log="${SERVE_LOG:-${RUNNER_TEMP:-/tmp}/functions-serve.log}"
body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

eval "$(npx supabase status -o env)"
# FUNCTIONS_URL is only reported while the Edge Runtime runs, so derive it from the API URL.
functions_url="$API_URL/functions/v1"
publishable_key="$PUBLISHABLE_KEY"
probe_email="${PROBE_USER_EMAIL:-admin@alpine.example.com}"
probe_password="${PROBE_USER_PASSWORD:-password123}"

mapfile -t functions < <("$script_dir/functions-test-cmd-builder.sh" list)
if [[ ${#functions[@]} -eq 0 ]]; then
  echo "::notice::No Edge Functions in the workspace; nothing to serve."
  exit 0
fi

# A real user JWT gets past verify_jwt, so the probe reaches the function itself.
user_jwt="$(curl -s "$API_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $publishable_key" -H "Content-Type: application/json" \
  -d "$(jq -n --arg email "$probe_email" --arg password "$probe_password" '{email: $email, password: $password}')" \
  | jq -r '.access_token // empty')"
if [[ -z "$user_jwt" ]]; then
  echo "::error::Could not sign in the probe user $probe_email. Is supabase/seed.sql loaded?"
  exit 1
fi

nohup npx supabase functions serve > "$serve_log" 2>&1 &
echo "Serving Edge Functions (log: $serve_log)"

for name in "${functions[@]}"; do
  echo "Waiting for $name..."
  code=000
  for _ in $(seq 1 60); do
    code="$(curl -s -o "$body_file" -w '%{http_code}' -X POST \
      -H "Authorization: Bearer $user_jwt" -H "apikey: $publishable_key" \
      "$functions_url/$name" || true)"
    if grep -qE '"code": ?"(BOOT|WORKER)_ERROR"' "$body_file"; then
      echo "::error::$name failed to start: $(cat "$body_file")"
      cat "$serve_log"
      exit 1
    fi
    case "$code" in
      000 | 502 | 503 | 504) sleep 2 ;;
      *)
        echo "$name is up (HTTP $code)"
        continue 2
        ;;
    esac
  done
  echo "::error::$name did not become ready (last HTTP $code)"
  cat "$serve_log"
  exit 1
done
