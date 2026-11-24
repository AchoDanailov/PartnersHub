import { expect, test } from '@playwright/test'
import { signIn, users } from './helpers'

// Фитнес клуб Черноморец: no test issues or redeems its vouchers, so the seeded counts hold.
test('an admin sees the dashboard', async ({ page }) => {
  await signIn(page, users.harborAdmin)
  await page.getByRole('link', { name: 'Табло' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Табло' })).toBeVisible()
  await expect(page.getByText('Фитнес клуб Черноморец')).toBeVisible()
  for (const label of ['Валидни', 'Използвани', 'Изтекли', 'Анулирани']) {
    await expect(page.locator('dl > div').filter({ hasText: label }).locator('dd')).toHaveText('1')
  }
})

test('staff cannot open the dashboard', async ({ page }) => {
  await signIn(page, users.alpineStaff)
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Използване на ваучер' })).toBeVisible()
})
