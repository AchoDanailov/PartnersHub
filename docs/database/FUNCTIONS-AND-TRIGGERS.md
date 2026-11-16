# Functions and triggers

Access rules for callable functions are in `RLS.md`.

## Triggers

### organization_members

- `organization_members_prevent_reassignment` → `private.prevent_member_reassignment()`
  Before update of `user_id`/`organization_id`: blocks changing either.
- `organization_members_ensure_organization_active` → `private.ensure_organization_active()`
  Before insert: rejects new members in a deactivated organization.

### services

- `services_prevent_organization_change` → `private.prevent_service_organization_change()`
  Before update of `organization_id`: blocks moving a service to another organization.
- `services_ensure_organization_active` → `private.ensure_organization_active()`
  Before insert: rejects new services in a deactivated organization.

### vouchers

- `vouchers_validate_redeemer_organization` → `private.validate_voucher_redeemer_organization()`
  Before insert/update of `service_id`/`redeemed_by`: the redeemer must be a current member of the service's organization.
- `vouchers_ensure_organization_active` → `private.ensure_voucher_organization_active()`
  Before insert: rejects new vouchers for a service of a deactivated organization.

### service_faqs

- `service_faqs_ensure_organization_active` → `private.ensure_service_faq_organization_active()`
  Before insert: rejects new questions for a service of a deactivated organization.

### service_images

- `service_images_ensure_organization_active` → `private.ensure_service_image_organization_active()`
  Before insert: rejects new images for a service of a deactivated organization.

## Functions

### Helpers (used by RLS policies)

- `private.current_organization_id()`: the caller's current organization.
- `private.current_organization_role()`: the caller's role in it.

### RPCs

- `public.get_voucher_redemptions()`: redeemed vouchers of the caller's organization, admin only. Wraps `private.voucher_redemptions()`.
- `public.remove_organization_member(p_actor_id, p_user_id)`: sets `left_at` on a staff member; `service_role` only.
