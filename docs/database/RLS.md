# Row Level Security

## Read access 

All tables have RLS enabled. Column-level grants limit which columns each role can select.

| Table | `anon` | `authenticated` |
| --- | --- | --- |
| `profiles` | none | Own profile; admins also see profiles of their organization's members |
| `organization_members` | none | Own membership; admins also see all members of their organization |
| `organizations` | All rows: `id`, `name` | Members of that organization |
| `services` | All rows: `id`, `organization_id`, `name`, `tagline`, `description` | Members of the owning organization |
| `vouchers` | All rows: `id`, `status`, `expires_on` | Members of the owning organization: `id`, `service_id`, `status`, `expires_on` |
| `service_images` | All rows: `id`, `service_id`, `path`, `alt_text`, `sort_order` | Members of the owning organization |
| `service_faqs` | none | The current admin of the owning organization |
| `voucher_code_attempts` | none | none |

### Other open interfaces to read resources

#### Vouchers

- **`public.organization_vouchers`** (view, `security_invoker = true`): `id`, `service_id`, `status`, `expires_on` for the caller's organization. Staff and admins can both read it, and both can count vouchers by status.
- **`public.get_voucher_redemptions()`** (RPC, admin only): `id`, `service_id`, `redemption_code`, `redeemed_by`, `redeemed_at` for the caller's organization, **redeemed vouchers only**.
  - Codes of active or cancelled vouchers are never returned, not even to admins.
  - Non-admins get an empty result.

---

## Write access

### anon

- **Has no write access**

### anon

- **Checking a voucher by QR token** - anyone with the publishable key goes through the `voucher-status` Edge Function, which reads the voucher with `service_role` and returns its state, never its code (`docs/adr/0005-redeem-vouchers-by-qr-token-or-code.md`).

### authenticated

- **Updating own username** - may update `profiles.username`, on their own non-anonymized profile. 
- **Redeeming vouchers** - current members go through the `redeem-voucher` Edge Function, which checks their membership under RLS, then reads and updates the voucher with `service_role`. Failed typed codes are recorded in `voucher_code_attempts` and limited per member.
- **Removing organization member** - organisation admins go through the `soft-remove-organization-member` Edge Function, which authenticates and authorizes them. They cannot call the RPC directly.

### service_role

- **Full access to all tables, and bypasses RLS**
- **Service images** - only `service_role` writes `service_images` rows and objects in the `service-images` bucket. Upload Edge Functions will do both.
- **Service content** - only `service_role` writes `services.tagline`, `services.description` and `service_faqs` rows.
- **Issuing vouchers** - only `service_role` creates `vouchers` rows and objects in the `generated-qrs` bucket. The `issue-voucher` Edge Function does both. Its caller is not a Supabase user: it sends a secret that only this function accepts (`docs/adr/0004-issue-vouchers-with-a-function-specific-secret.md`).
- **Removing organization member** - `public.remove_organization_member(p_actor_id, p_user_id)` (RPC, only `service_role` can call): called by the `soft-remove-organization-member` Edge Function or an operator. `p_actor_id` must be the current admin of the staff member's organization, for every caller. The Edge Function then uses the Admin API to soft delete the user (from the `auth` table), thus releasing the email to be used again in a different organization.

---

## Storage

### Service images

Public bucket `service-images` (5 MiB; JPEG, PNG, WebP, AVIF). One `public.service_images` row per file; `path` is its key.

| Action | `anon`, `authenticated` | `service_role` |
| --- | --- | --- |
| Download by URL | Yes | Yes |
| List | No | Yes |
| Upload, replace, delete | No | Yes |

- No policies on `storage.objects`, so only `service_role` can list or write.
- Anyone with the URL can download, so nothing private goes here.
- Frontend URL: `supabase.storage.from('service-images').getPublicUrl(path)`.

### Voucher QR codes

Private bucket `generated-qrs` (1 MiB; PNG), at `<voucher_id>.png`.

- Only `service_role` can read, list or write; there is no public URL.
- A QR code holds the voucher's `qr_token`, not its redemption code.
