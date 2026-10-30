import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('consultation publique (visiteur)', () => {
  test('accueil : message prudent, avertissement et navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Jamais « zone sûre » ni « aucun danger » : formulations interdites.
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/zone sûre|aucun danger/i);
    await expect(page.getByText('n’est pas un service officiel de secours').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Signaler un événement/ })).toBeVisible();
  });

  test('carte : rendu MapLibre avec fond de repli et légende', async ({ page }) => {
    await page.goto('/carte');
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Carte interactive des événements' }),
    ).toBeVisible();
    await expect(page.getByText(/événements? dans la zone affichée/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Me localiser/ })).toBeVisible();
  });

  test('recherche de lieu avec graphie kabyle', async ({ page }) => {
    await page.goto('/carte');
    await page.getByLabel('Rechercher un lieu').fill('larbaa nath irathen');
    await expect(page.getByRole('option', { name: /Larbaa N'Aït Irathen/ })).toBeVisible();
  });

  test('arabe : direction RTL et texte traduit', async ({ page, context }) => {
    await context.addCookies([{ name: 'locale', value: 'ar', url: 'http://localhost:3000' }]);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByRole('link', { name: 'الإبلاغ عن حدث' })).toBeVisible();
    await expect(page.getByText('الترجمة', { exact: false }).first()).toBeVisible(); // avis « traduction non relue »
  });

  test('pages protégées : redirection vers la connexion', async ({ page }) => {
    await page.goto('/signaler');
    await expect(page).toHaveURL(/\/connexion\?next=%2Fsignaler/);
    await page.goto('/admin');
    await expect(page.getByText('Accès réservé à l’équipe de modération.')).toBeVisible();
  });

  test('en-têtes de sécurité', async ({ request }) => {
    const res = await request.get('/');
    const headers = res.headers();
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-powered-by']).toBeUndefined();
  });

  test('accessibilité : aucune violation axe critique ou sérieuse', async ({ page }) => {
    for (const path of ['/', '/alertes', '/connexion', '/inscription', '/consignes']) {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(blocking.map((v) => `${path} ${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    }
  });
});
