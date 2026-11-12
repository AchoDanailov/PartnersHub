# 3. Store service images in a public bucket, catalogued by a table

- Status: Accepted
- Date: 2026-11-12

## Context

Each service needs a few images. Clients reach service pages through QR codes
without signing in, so the images must load for anonymous visitors. Partners
and their staff see the same images for their own organization's services.

Supabase Storage holds files as objects in a bucket, addressed by a path. The
frontend also needs to know which objects belong to which service, in a way it
can query together with the service itself.

The frontend is not built yet, so how images are laid out (a hero image, a
gallery, an order) is not decided.

## Decision

Image files live in the public bucket `service-images`, limited to 5 MiB per
file and to JPEG, PNG, WebP and AVIF. The bucket is created in a migration.

`public.service_images` is the catalogue. A row holds the `service_id`, the
object `path` inside the bucket, an optional `alt_text` and a `sort_order`.
Paths follow `<organization_id>/<service_id>/<image_id>.<ext>`. The convention
is documented here and will be enforced by the upload function, not by the
database.

`sort_order` is the position of an image within its service, lowest first. It
defaults to 0 and is not unique, so images are read with
`order by sort_order, created_at`.

`service_id` references `services` with `on delete cascade`: deleting a service
deletes its image rows. `service_id` can be changed by `service_role`; no
trigger pins an image to its service.

Access:

- `anon` reads every `service_images` row. `authenticated` reads the rows of
  their own organization's services. Neither can write.
- There are no policies on `storage.objects`, so `anon` and `authenticated` can
  download an object by its public URL but cannot list or write objects.
- Only `service_role` writes rows and objects. Upload and delete will go
  through Edge Functions.

Local development and CI get seed images from `supabase/seed/service-images`.
`supabase/config.toml` declares the same bucket with an `objects_path`, which
makes the CLI upload those files. `supabase/seed.sql` inserts the matching
rows. `.github/scripts/check-seed-images.sh` checks on CI that rows, files and
anonymous access agree.

## Alternatives rejected

- **Private bucket with signed URLs.** The images are marketing material meant
  for anonymous visitors. Signed URLs add a server round trip, expire, and
  defeat CDN caching, to protect files that are not secret.
- **Foreign key from `service_images` to `storage.objects`.** It ties the
  schema to a table owned by the Storage service, whose layout can change
  between versions, and it blocks the Storage API from deleting an object while
  a row points at it.
- **Storage policies that let admins upload from the browser.** Uploads need
  validation and a row written alongside the object. One server-side function
  is easier to reason about than policies on a shared system table.
- **Bucket defined only in `config.toml`.** A hosted project would not get it
  from `supabase db push`, and pgTAP could not assert its settings.
- **A unique `sort_order` per service.** Swapping two positions would need a
  deferrable constraint or a transaction, which a single Data API call cannot
  give. A tie-break on `created_at` keeps the order deterministic without it.
- **More presentation columns now (`kind`, `width`, `height`).** The frontend
  design is undecided. Each is a small additive migration later, and there is
  no production data to backfill.

## Consequences

- Anyone who has a URL can read the file. Nothing private may be stored in
  this bucket.
- A row and its object are written separately. The upload function must clean
  up when one of the two writes fails, and deleting a row does not delete the
  file.
- Deleting a service removes its image rows but leaves the files in the bucket.
  Whatever deletes a service must also delete its objects, or they stay
  publicly readable by URL.
- If an image is moved to another service, its `path` still names the old
  service. The path is an opaque object key: nothing may derive the service or
  organization from it.
- `anon` can read `created_at` on this table, unlike on the others, because it
  breaks ties between images that share a `sort_order`.
- The bucket's settings exist twice for local development: in the migration
  and in `config.toml`. The CLI overwrites the local bucket with the
  `config.toml` values, so the two must be kept identical. The pgTAP test
  asserts the expected values.
- Seed images must be files the bucket accepts. Any other file placed under
  `supabase/seed/service-images` fails the upload.
