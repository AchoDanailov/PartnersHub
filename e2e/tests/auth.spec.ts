import { expect, test } from '@playwright/test'
import { signIn, users } from './helpers'

test('staff signs in and sees their organization', async ({ page }) => {
  await signIn(page, users.alpineStaff)
  await expect(page.getByText('Пирин СПА')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Табло' })).toHaveCount(0)
})

test('a wrong password is rejected', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Имейл').fill(users.alpineStaff)
  await page.getByLabel('Парола').fill('wrong-password')
  await page.getByRole('button', { name: 'Вход' }).click()
  await expect(page.getByRole('alert')).toHaveText('Грешен имейл или парола.')
})

test('signing out returns to the sign-in page', async ({ page }) => {
  await signIn(page, users.alpineStaff)
  await page.getByRole('button', { name: 'Изход' }).click()
  await expect(page.getByRole('heading', { name: 'Вход за партньори' })).toBeVisible()
})
