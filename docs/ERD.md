# Entity Relationship Diagram

Sources:

- `supabase/migrations/20261029211310_initial_data_layer.sql`
- `supabase/migrations/20261102223932_soft_deletion.sql`

```mermaid
erDiagram
    auth_users ||--o| profiles : "has profile"
    profiles ||--o| organization_members : "belongs to one organization"
    organizations ||--o{ organization_members : "has members"
    organizations ||--o{ services : "offers"
    services ||--o{ vouchers : "issues"
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
        text redemption_code UK "not blank"
        uuid service_id FK "references services.id, on delete restrict"
        date expires_on "not before the created_at date (UTC)"
        timestamptz created_at "default now()"
        voucher_status status "active, redeemed or cancelled; default active"
        uuid redeemed_by FK "nullable; references organization_members.user_id, on delete restrict"
        timestamptz redeemed_at "nullable"
    }
```

## Enums

| Type | Values |
| --- | --- |
| `public.organization_role` | `admin`, `staff` |
| `public.voucher_status` | `active`, `redeemed`, `cancelled` |
