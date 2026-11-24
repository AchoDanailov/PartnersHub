import { expect, type Page } from '@playwright/test'

// Seed data from supabase/seeding/seed.sql.
export const PASSWORD = 'password123'

export const users = {
  alpineAdmin: 'admin@alpine.example.com',
  alpineStaff: 'staff-1@alpine.example.com',
  harborAdmin: 'admin@harbor.example.com',
}

export const alpineOrganizationId = 'a1000000-0000-0000-0000-000000000001'

export const services = {
  massage: 'a4000000-0000-0000-0000-000000000001',
  sauna: 'a4000000-0000-0000-0000-000000000002',
}

/** Seeded vouchers that are not active, so no test ever changes them. */
export const seededVouchers = {
  redeemed: { code: 'BLV-M4S7A2', serviceId: services.massage, qrToken: 'a7000000-0000-4000-8000-000000000002' },
  cancelled: { serviceId: services.massage, qrToken: 'a7000000-0000-4000-8000-000000000003' },
  expired: { serviceId: services.sauna, qrToken: 'a7000000-0000-4000-8000-000000000005' },
}

/** Signs in on the home page and waits for the member home. */
export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/')
  await page.getByLabel('Имейл').fill(email)
  await page.getByLabel('Парола').fill(password)
  await page.getByRole('button', { name: 'Вход' }).click()
  await expect(page.getByRole('heading', { name: 'Използване на ваучер' })).toBeVisible()
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set. See "End-to-end tests" in CONTRIBUTING.md.`)
  return value
}

/**
 * Issues a new active Пирин СПА Сауна voucher through the issue-voucher Edge Function, so
 * redeem tests never use up seeded data. The function does not return the code or the QR
 * token, so they are read from the row with the local secret key.
 */
export async function issueVoucher() {
  const url = requireEnv('SUPABASE_URL')
  const secretKey = requireEnv('SUPABASE_SECRET_KEY')
  const issuerSecret = requireEnv('VOUCHER_ISSUER_SECRET')

  const issued = await fetch(`${url}/functions/v1/issue-voucher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Voucher-Issuer-Secret': issuerSecret },
    body: JSON.stringify({
      organizationId: alpineOrganizationId,
      serviceId: services.sauna,
      expiresOn: '2099-12-31',
      idempotencyKey: crypto.randomUUID(),
    }),
  })
  if (issued.status !== 201) throw new Error(`issue-voucher answered ${issued.status}: ${await issued.text()}`)
  const { voucherId } = (await issued.json()) as { voucherId: string }

  const row = await fetch(`${url}/rest/v1/vouchers?id=eq.${voucherId}&select=redemption_code,qr_token`, {
    headers: { apikey: secretKey, Accept: 'application/vnd.pgrst.object+json' },
  })
  if (!row.ok) throw new Error(`Reading voucher ${voucherId} failed with ${row.status}: ${await row.text()}`)
  const voucher = (await row.json()) as { redemption_code: string; qr_token: string }

  return { code: voucher.redemption_code, qrToken: voucher.qr_token, serviceId: services.sauna }
}
