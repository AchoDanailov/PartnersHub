# 3. Store service images in a public bucket

## Context

Clients open service pages from QR codes without signing in, so service images
must load for anonymous visitors. The frontend also needs to query which images
belong to a service.

## Decisions

### Public Access

Files live in the public bucket `service-images` (5 MiB per file; JPEG, PNG,
WebP or AVIF).

**Reasons**:
- The images are public marketing material.
- Signed-in members read only the rows of their own organization. Currently its
easier to implement, while in the future this most certainly might change.

Details on access are in `docs/database/RLS.md`.

### Path convention

Paths follow `<organization_id>/<service_id>/<image_id>.<ext>`. The database
enforces neither this nor that a row and its file exist together. Upload and
delete Edge Functions, not yet implemented, will keep them in sync.

### Local bucket config (config.toml) vs migration bucket config

- The migration `20261112115255_service_images.sql` creates the public bucket.
This goes in remote projects too.
- `supabase/config.toml` declares it again, only so the CLI can seed the local
seed files (`seeding/seed/`). The `supabase/config.toml` file takes presedence
locally, so to keep the local environment as identical as possible to remote
environment we keep the `[storage.buckets.service-images]` section in
`supabase/config.toml` and the `service-images` bucket declared in the
migrations in sync. 

## Alternatives rejected

### Private bucket with signed URLs
Extra setup required which is not necessary for the purpose of the bucket. An
extra round trip, expiring links and no CDN caching.

### Foreign key to `storage.objects` (biggest contender)
The storage docs say to consider all records in Storage tables as read-only. All
operations, including uploading, copying, moving, and deleting, should
exclusively go through the API. You’re allowed to read those tables. Building
constraints and write logic on top of them goes against the intended design. 
supabase

## Consequences

- Anyone who has the URL reads the file. Nothing private goes in this bucket.
- Deleting a row, or a service (which deletes its rows), leaves the files in
  the bucket, still readable by URL, until the delete Edge Function removes
  both.
