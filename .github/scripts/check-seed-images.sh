#!/usr/bin/env bash
# Checks the seeded service images end to end against the running local stack.
#
# Usage: check-seed-images.sh
#   Run from the repository root with the local stack running (`npx supabase start`),
#   which applies supabase/seed.sql and uploads the files under $SEED_IMAGES_DIR
#   (default: supabase/seed/service-images) into the public service-images bucket.
#   Fails when:
#   - the paths anonymous users read from public.service_images differ from the seed files
#   - a seeded image is not downloadable by plain URL, or has the wrong content type
#   - anonymous users can list the bucket or upload into it
set -euo pipefail

bucket="service-images"
seed_dir="${SEED_IMAGES_DIR:-supabase/seed/service-images}"
body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

eval "$(npx supabase status -o env)"
# The same headers supabase-js sends for a signed-out visitor.
anon_headers=(-H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $PUBLISHABLE_KEY")
failed=0

fail() {
  echo "::error::$1"
  failed=1
}

# 1. The table is the catalogue: its paths must match the seed files exactly.
row_paths="$(curl -sS --fail-with-body "${anon_headers[@]}" \
  "$API_URL/rest/v1/service_images?select=path&order=path" | jq -r '.[].path' | sort)"
file_paths="$(cd "$seed_dir" && find . -type f | sed 's|^\./||' | sort)"

if [[ -z "$row_paths" ]]; then
  fail "Anonymous users read no service_images rows. Is supabase/seed.sql loaded?"
fi
if ! diff <(echo "$row_paths") <(echo "$file_paths") > "$body_file"; then
  fail "service_images paths (<) and files in $seed_dir (>) differ:"
  cat "$body_file"
fi

# 2. Every seeded image is served by plain URL, without any key.
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  case "$path" in
    *.jpg | *.jpeg) expected_type="image/jpeg" ;;
    *.png) expected_type="image/png" ;;
    *.webp) expected_type="image/webp" ;;
    *.avif) expected_type="image/avif" ;;
    *) fail "$path has an extension the bucket does not allow"; continue ;;
  esac
  result="$(curl -s -o /dev/null -w '%{http_code} %{content_type}' \
    "$API_URL/storage/v1/object/public/$bucket/$path" || true)"
  if [[ "$result" == "200 $expected_type"* ]]; then
    echo "ok  $path ($result)"
  else
    fail "$path: expected '200 $expected_type', got '$result'"
  fi
done <<< "$file_paths"

# 3. Anonymous users cannot list the bucket.
list_code="$(curl -s -o "$body_file" -w '%{http_code}' -X POST "${anon_headers[@]}" \
  -H "Content-Type: application/json" -d '{"prefix": "", "limit": 100}' \
  "$API_URL/storage/v1/object/list/$bucket" || true)"
if [[ "$list_code" == "200" ]] && [[ "$(jq 'length' "$body_file")" == "0" ]]; then
  echo "ok  anonymous listing returns nothing"
elif [[ "$list_code" == 4* ]]; then
  echo "ok  anonymous listing is rejected (HTTP $list_code)"
else
  fail "Anonymous listing of $bucket returned HTTP $list_code: $(cat "$body_file")"
fi

# 4. Anonymous users cannot upload. A 1x1 PNG passes the bucket's MIME allow-list,
#    so only the missing storage.objects policy can reject it.
probe_path="anon-upload-probe-$$.png"
upload_code="$(echo 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==' \
  | base64 -d \
  | curl -s -o "$body_file" -w '%{http_code}' -X POST "${anon_headers[@]}" \
    -H "Content-Type: image/png" --data-binary @- \
    "$API_URL/storage/v1/object/$bucket/$probe_path" || true)"
if [[ "$upload_code" == 2* ]]; then
  fail "Anonymous upload into $bucket succeeded (HTTP $upload_code): $(cat "$body_file")"
else
  echo "ok  anonymous upload is rejected (HTTP $upload_code)"
fi

exit "$failed"
