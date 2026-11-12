# 3. Store service images in a public bucket

- Status: Accepted
- Date: 2026-11-12

## Context

Clients open service pages from QR codes without signing in, so service images
must load for anonymous visitors. The frontend also needs to query which images
belong to a service.

## Decision

- Files live in the public bucket `service-images` (5 MiB per file; JPEG, PNG,
  WebP or AVIF).
- `public.service_images` has one row per image: its `service_id`, the file's
  `path` in the bucket, an optional `alt_text` and a `sort_order`.
- Paths follow `<organization_id>/<service_id>/<image_id>.<ext>`. The upload
  function enforces this, not the database.
- `sort_order` is unique per service. The constraint is deferrable, so one
  update can swap positions.

### Access

Details are in `docs/RLS.md`.

- Anyone reads every row and downloads any file by its URL: the images are
  public marketing material.
- Signed-in members read only the rows of their own organization.
- Only `service_role` writes rows and files, through Edge Functions, because a
  file and its row must be validated and written together. There are no
  policies on `storage.objects`, so nobody else can list or write files.

### The bucket is defined twice

- The migration creates it. `supabase db push` applies only migrations, so this
  is what a hosted project gets.
- `supabase/config.toml` declares it again, only so the CLI uploads the local
  seed files. The CLI overwrites the local bucket's settings with these values,
  so the two must stay identical.

## Alternatives rejected

- **Private bucket with signed URLs.** An extra round trip, expiring links and
  no CDN caching, to protect files that are not secret.
- **Foreign key to `storage.objects`.** It ties the schema to a table the
  Storage service owns, and blocks Storage from deleting a file while a row
  points at it.

## Consequences

- Anyone who has the URL reads the file. Nothing private goes in this bucket.
- Deleting a row, or a service (which deletes its rows), leaves the files in
  the bucket, still readable by URL. Whatever deletes them must delete the
  files too.
- `path` is an opaque key. An image moved to another service keeps its old
  path, so never derive the service or organization from it.
