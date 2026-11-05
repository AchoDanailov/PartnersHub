# Row Level Security

## Read access 

All tables have RLS enabled. Column-level grants limit which columns each role can select.

| Table | `anon` | `authenticated` |
| --- | --- | --- |
| `profiles` | none | Own profile; admins also see profiles of their organization's members |
| `organization_members` | none | Own membership; admins also see all members of their organization |
| `organizations` | All rows: `id`, `name` | Members of that organization |
| `services` | All rows: `id`, `organization_id`, `name` | Members of the owning organization |
| `vouchers` | All rows: `id`, `status`, `expires_on` | Members of the owning organization: `id`, `service_id`, `status`, `expires_on` |

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

### authenticated

- **Updating own username** - may update `profiles.username`, on their own non-anonymized profile. 
- **Removing organization member** - admins go through the `remove-organization-member` Edge Function, which authenticates and authorizes them. They cannot call the RPC directly.

### service_role

- **Full access to all tables, and bypasses RLS**
- **Removing organization member** - `public.remove_organization_member(p_actor_id, p_user_id)` (RPC, only `service_role` can call): called by the `remove-organization-member` Edge Function or an operator. `p_actor_id` must be the current admin of the staff member's organization, for every caller. The Edge Function then uses the Admin API to soft delete the user (from the `auth` table), thus releasing the email to be used again in a different organization.