#!/usr/bin/env bash
# Runs a Deno command for all Edge Functions from the supabase/functions/ workspace root.
#
# Usage: functions-test-cmd-builder.sh <install|list|TASK>
#   install  Restore dependencies (deno install --frozen when deno.lock exists).
#   list     Print the function names in the root deno.json "workspace", one per line.
#   TASK     Run `deno task TASK` (e.g. check, test, test:integration) defined in
#            supabase/functions/deno.json. test:integration is skipped with a notice
#            when no tests/**/*.integration-tests.ts file exists.
set -euo pipefail

task="${1:?usage: functions-test-cmd-builder.sh <install|list|TASK>}"
functions_dir="${FUNCTIONS_DIR:-supabase/functions}"

cd "$functions_dir"

case "$task" in
  install)
    cmd=(deno install)
    [[ -f deno.lock ]] && cmd+=(--frozen)
    ;;
  list)
    jq -r '.workspace // [] | .[] | sub("^\\./"; "")' deno.json
    exit 0
    ;;
  test:integration)
    if [[ -z "$(find tests -name '*.integration-tests.ts' -print -quit 2>/dev/null)" ]]; then
      echo "::notice::No tests/**/*.integration-tests.ts files in $functions_dir; nothing to run."
      exit 0
    fi
    cmd=(deno task "$task")
    ;;
  *)
    cmd=(deno task "$task")
    ;;
esac

"${cmd[@]}"
