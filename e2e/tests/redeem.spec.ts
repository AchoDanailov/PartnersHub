import { expect, test } from '@playwright/test'
import { issueVoucher, signIn, users } from './helpers'

test('staff redeem a voucher by code', async ({ page }) => {
  const voucher = await issueVoucher()
  await signIn(page, users.alpineStaff)

  await page.getByLabel('Код от ваучера').fill(voucher.code)
  await page.getByRole('button', { name: 'Провери ваучера' }).click()
  await expect(page.getByText('Валиден', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Използвай ваучера' }).click()
  await expect(page.getByRole('status')).toHaveText('Ваучерът е използван')
})

test('staff redeem a voucher from its QR link', async ({ page }) => {
  const voucher = await issueVoucher()
  await signIn(page, users.alpineStaff)

  await page.goto(`/services/${voucher.serviceId}?t=${voucher.qrToken}`)
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText('Валиден', { exact: true })).toBeVisible()

  await sheet.getByRole('button', { name: 'Използвай ваучера' }).click()
  await expect(sheet.getByRole('status')).toHaveText('Ваучерът е използван')
})
