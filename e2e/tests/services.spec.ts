import { expect, test } from '@playwright/test'
import { signIn, users } from './helpers'

test('visitors see every service and open one', async ({ page }) => {
  await page.goto('/services')
  await expect(page.getByRole('heading', { name: 'Преживявания' })).toBeVisible()
  for (const name of ['Масаж', 'Сауна', 'Дневна карта', 'Йога', 'Пилатес']) {
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()
  }

  await page.getByRole('link', { name: /Масаж/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Масаж' })).toBeVisible()
})

test('staff see only their organization’s services', async ({ page }) => {
  await signIn(page, users.alpineStaff)
  await expect(page.getByRole('heading', { name: 'Вашите услуги' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Масаж' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Сауна' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Йога' })).toHaveCount(0)
})
