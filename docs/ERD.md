# Entity Relationship Diagram

Sources:

- `supabase/migrations/20261029211310_initial_data_layer.sql`
- `supabase/migrations/20261102223932_soft_deletion.sql`
- `supabase/migrations/20261112115255_service_images.sql`
- `supabase/migrations/20261113180000_voucher_issuance.sql`

```mermaid
erDiagram
    auth_users ||--o| profiles : "has profile"
    profiles ||--o| organization_members : "belongs to one organization"
    organizations ||--o{ organization_members : "has members"
    organizations ||--o{ services : "offers"
    services ||--o{ vouchers : "issues"
    services ||--o{ service_images : "is shown by"
    organization_members |o--o{ vouchers : "redeems"

    auth_users {
        uuid id PK "Supabase Auth, external to public schema"
    }

    profiles {
        uuid id PK, FK "references auth.users.id, on delete cascade"
        text username UK "trimmed, lowercase, not blank"
        timestamptz created_at "default now()"
        boolean is_anonymized "default false; true iff username starts with anonymized-"
    }

    organizations {
        uuid id PK "default gen_random_uuid()"
        text name "not blank"
        timestamptz created_at "default now()"
        timestamptz deactivated_at "nullable; null = active; not before created_at"
    }

    organization_members {
        uuid user_id PK, FK "references profiles.id, on delete cascade; immutable"
        uuid organization_id FK "references organizations.id, on delete restrict; immutable"
        organization_role role "admin or staff, default staff; max one current admin per organization"
        timestamptz created_at "default now()"
        timestamptz left_at "nullable; null = current member; not before created_at"
    }

    services {
        uuid id PK "default gen_random_uuid()"
        uuid organization_id FK "references organizations.id, on delete restrict; immutable"
        text name "not blank"
        timestamptz created_at "default now()"
    }

    vouchers {
        uuid id PK "default gen_random_uuid()"
        text redemption_code UK "not blank; clear text; issued codes are BLV- plus 6 uppercase letters or digits"
        uuid service_id FK "references services.id, on delete restrict"
        date expires_on "not before the created_at date (UTC)"
        timestamptz created_at "default now()"
        voucher_status status "active, redeemed or cancelled; default active"
        uuid redeemed_by FK "nullable; references organization_members.user_id, on delete restrict"
        timestamptz redeemed_at "nullable"
        text shopify_order_id "nullable; digits only"
        text shopify_line_item_id "nullable; digits only"
        integer shopify_line_item_unit "nullable; 1 or more; which unit of the line item"
    }

    service_images {
        uuid id PK "default gen_random_uuid()"
        uuid service_id FK "references services.id, on delete cascade"
        text path UK "object key in the service-images bucket; not blank, no leading slash"
        text alt_text "nullable; not blank when present"
        integer sort_order "not negative; position within the service, unique per service"
        timestamptz created_at "default now()"
    }
```

`service_images.path` points at an object in the public `service-images` Storage bucket. There is no foreign key into `storage.objects`, so deleting a row (directly or by deleting its service) leaves the file in the bucket; see `docs/adr/0003-store-service-images-in-a-public-bucket.md`.

The three `vouchers.shopify_*` columns say which sale a voucher came from. They are all set or all null, and unique together, so the `issue-voucher` Edge Function can be called again for the same sale without creating a second voucher. Each issued voucher has a QR code at `<voucher_id>.png` in the private `generated-qrs` Storage bucket; see `docs/adr/0004-issue-vouchers-through-a-shared-secret-webhook.md`.

## Enums

| Type | Values |
| --- | --- |
| `public.organization_role` | `admin`, `staff` |
| `public.voucher_status` | `active`, `redeemed`, `cancelled` |
