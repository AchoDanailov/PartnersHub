#!/usr/bin/env bash
# Runs a Deno command in every Edge Function under supabase/functions/.
#
# Usage: functions-task.sh <install|list|TASK> [--optional]
#   install     Restore dependencies (deno install, --frozen when a deno.lock exists).
#   list        Print the discovered function names, one per line.
#   TASK        Run `deno task TASK` (e.g. check, test, test:integration).
#   --optional  Skip functions whose deno.json does not define TASK.
#
# Directories starting with "_" (e.g. _shared) are not functions and are skipped.
# Every function is processed; the script exits non-zero if any of them failed.
set -euo pipefail

task="${1:?usage: functions-task.sh <install|list|TASK> [--optional]}"
optional="${2:-}"
functions_dir="${FUNCTIONS_DIR:-supabase/functions}"

functions=()
for config in "$functions_dir"/*/deno.json; do
  [[ -f "$config" ]] || continue
  name="$(basename "$(dirname "$config")")"
  [[ "$name" == _* ]] && continue
  functions+=("$name")
done

if [[ "$task" == "list" ]]; then
  [[ ${#functions[@]} -eq 0 ]] || printf '%s\n' "${functions[@]}"
  exit 0
fi

if [[ ${#functions[@]} -eq 0 ]]; then
  echo "::notice::No Edge Functions found in $functions_dir; nothing to run for '$task'."
  exit 0
fi

failed=()
for name in "${functions[@]}"; do
  dir="$functions_dir/$name"

  if [[ "$task" != "install" && "$optional" == "--optional" ]] \
    && ! jq -e --arg t "$task" '.tasks[$t] != null' "$dir/deno.json" >/dev/null; then
    echo "Skipping $name: no '$task' task defined."
    continue
  fi

  echo "::group::$name: $task"
  if [[ "$task" == "install" ]]; then
    cmd=(deno install)
    [[ -f "$dir/deno.lock" ]] && cmd+=(--frozen)
  else
    cmd=(deno task "$task")
  fi
  if (cd "$dir" && "${cmd[@]}"); then
    echo "::endgroup::"
  else
    echo "::endgroup::"
    echo "::error::$name: '$task' failed"
    failed+=("$name")
  fi
done

if [[ ${#failed[@]} -gt 0 ]]; then
  echo "Failed: ${failed[*]}" >&2
  exit 1
fi
