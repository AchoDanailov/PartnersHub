#!/usr/bin/env bash
# Serves every Edge Function against the running local stack and waits until each one boots.
#
# Usage: serve-functions.sh
#   Run from the repository root with the local stack running (`npx supabase start`).
#   Starts `npx supabase functions serve` in the background, then probes every function
#   listed by `functions-task.sh list`.
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
anon_key="$ANON_KEY"

mapfile -t functions < <("$script_dir/functions-task.sh" list)
if [[ ${#functions[@]} -eq 0 ]]; then
  echo "::notice::No Edge Functions in the workspace; nothing to serve."
  exit 0
fi

nohup npx supabase functions serve > "$serve_log" 2>&1 &
echo "Serving Edge Functions (log: $serve_log)"

for name in "${functions[@]}"; do
  echo "Waiting for $name..."
  code=000
  for _ in $(seq 1 60); do
    # The legacy anon key is a JWT, so it passes verify_jwt; any answer from the function means it booted.
    code="$(curl -s -o "$body_file" -w '%{http_code}' -X POST \
      -H "Authorization: Bearer $anon_key" -H "apikey: $anon_key" \
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
