import { expect, test } from '@playwright/test'
import { seededVouchers, signIn, users } from './helpers'

const qrCases = [
  { name: 'a redeemed voucher', voucher: seededVouchers.redeemed, label: 'Използван' },
  { name: 'a cancelled voucher', voucher: seededVouchers.cancelled, label: 'Анулиран' },
  { name: 'an expired voucher', voucher: seededVouchers.expired, label: 'Изтекъл' },
]

for (const { name, voucher, label } of qrCases) {
  test(`a client's QR link shows ${name}`, async ({ page }) => {
    await page.goto(`/services/${voucher.serviceId}?t=${voucher.qrToken}`)
    await expect(page.getByRole('dialog').getByText(label, { exact: true })).toBeVisible()
  })
}

test('staff check a used voucher by code', async ({ page }) => {
  await signIn(page, users.alpineStaff)
  await page.getByLabel('Код от ваучера').fill(seededVouchers.redeemed.code)
  await page.getByRole('button', { name: 'Провери ваучера' }).click()
  await expect(page.getByText('Ваучерът вече е използван и не може да се използва отново.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Използвай ваучера' })).toHaveCount(0)
})
