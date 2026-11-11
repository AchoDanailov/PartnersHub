#!/usr/bin/env bash
# Runs a Deno command for all Edge Functions from the supabase/functions/ workspace root.
#
# Usage: functions-task.sh <install|TASK>
#   install  Restore dependencies (deno install --frozen when deno.lock exists).
#   TASK     Run `deno task TASK` (e.g. check, test) defined in supabase/functions/deno.json.
set -euo pipefail

task="${1:?usage: functions-task.sh <install|TASK>}"
functions_dir="${FUNCTIONS_DIR:-supabase/functions}"

cd "$functions_dir"

if [[ "$task" == "install" ]]; then
  cmd=(deno install)
  [[ -f deno.lock ]] && cmd+=(--frozen)
else
  cmd=(deno task "$task")
fi

"${cmd[@]}"
