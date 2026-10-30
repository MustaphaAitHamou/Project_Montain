import { expect, test } from '@playwright/test';
import {
  createConfirmedUser,
  deleteUser,
  serviceClient,
  signIn,
  uniqueEmail,
  waitForConfirmationLink,
} from './helpers';

/**
 * Parcours MVP complet, exécuté une seule fois (projet desktop) :
 * inscription + confirmation e-mail → signalement → modération → publication →
 * suivi d'un village → notification in-app.
 */
test.describe.configure({ mode: 'serial' });

test.describe('parcours complet', () => {
  test.skip(({ isMobile }) => isMobile, 'parcours exécuté une seule fois (projet desktop)');

  const created: string[] = [];
  let reporterEmail = '';
  const reporterPassword = 'Tamurt2026Alerte';
  let reportDescription = '';

  test.afterAll(async () => {
    for (const id of created) await deleteUser(id);
  });

  test('inscription avec vérification de l’adresse e-mail', async ({ page }) => {
    reporterEmail = uniqueEmail('e2e-temoin');
    await page.goto('/inscription');
    await page.getByLabel('Adresse e-mail').fill(reporterEmail);
    await page.getByLabel('Mot de passe', { exact: true }).fill(reporterPassword);
    await page.getByLabel(/J’accepte les conditions/).check();
    await page.getByRole('button', { name: 'Créer un compte' }).click();
    await expect(page.getByText(/Vérifiez votre boîte e-mail/)).toBeVisible();

    const link = await waitForConfirmationLink(reporterEmail);
    await page.goto(link);
    await expect(page).toHaveURL(/bienvenue=1/);
    const { data } = await serviceClient().auth.admin.listUsers({ perPage: 200 });
    const user = data.users.find((u) => u.email === reporterEmail);
    expect(user?.email_confirmed_at).toBeTruthy();
    if (user) created.push(user.id);
  });

  test('signalement en 7 étapes avec position placée sur la carte', async ({ page }) => {
    await signIn(page, reporterEmail, reporterPassword, '/signaler');
    await expect(page).toHaveURL(/\/signaler/);
    await page.getByRole('radio', { name: 'Incendies' }).click();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.getByRole('radio', { name: 'Fumée signalée' }).click();
    await page.getByRole('button', { name: 'Suivant' }).click();

    // Le phénomène est placé sur la carte (pas la position du téléphone).
    const map = page.getByRole('application', { name: /Où se situe le phénomène/ });
    await expect(map.locator('.maplibregl-canvas')).toBeVisible();
    await page.waitForTimeout(1500);
    const box = await map.boundingBox();
    if (!box) throw new Error('carte absente');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByText(/^36\.\d+, 4\.\d+$/)).toBeVisible();
    await page.getByLabel(/Incertaine/).check();
    await page.getByRole('button', { name: 'Suivant' }).click();

    // Pas de longue suite de chiffres : elle serait (à raison) refusée comme numéro de téléphone.
    const token = Math.random()
      .toString(36)
      .replace(/[^a-z]/g, '')
      .slice(0, 8);
    reportDescription = `Fumée blanche visible au-dessus de la crête, test e2e ${token}`;
    await page.getByRole('textbox', { name: 'Description' }).fill(reportDescription);
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.getByRole('button', { name: 'Suivant' }).click(); // photo facultative
    await page.getByRole('button', { name: 'Suivant' }).click(); // heure : maintenant
    await page.getByLabel(/Je certifie/).check();
    await page.getByRole('button', { name: 'Envoyer le signalement' }).click();
    await expect(page.getByText('Signalement reçu')).toBeVisible();

    await page.goto('/profil/signalements');
    await expect(page.getByText(reportDescription)).toBeVisible();
    await expect(page.getByText('En attente de modération').first()).toBeVisible();
    // Non publié tant qu'il n'est pas modéré : aucun événement public n'y est rattaché.
    const { data: pending } = await serviceClient()
      .from('report_feed')
      .select('moderation_status, event_id')
      .eq('description', reportDescription)
      .single();
    expect(pending).toEqual({ moderation_status: 'pending', event_id: null });
  });

  test('modération par un administrateur puis publication', async ({ page, browser }) => {
    const admin = await createConfirmedUser('e2e-admin', ['admin']);
    created.push(admin.id);
    const follower = await createConfirmedUser('e2e-diaspora');
    created.push(follower.id);

    // Un membre de la diaspora suit la commune où se situe le signalement.
    const service = serviceClient();
    const { data: report } = await service
      .from('report_feed')
      .select('id, commune_code, lat, lng')
      .eq('description', reportDescription)
      .single();
    expect(report?.commune_code).toBeTruthy();
    const followerPage = await (await browser.newContext()).newPage();
    await signIn(followerPage, follower.email, follower.password, '/villages/ajouter');
    await followerPage.getByLabel('Ajouter un village ou une commune').fill('Iferhounene');
    await followerPage
      .getByRole('option', { name: /Iferhounene/ })
      .first()
      .click();
    await followerPage.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(followerPage).toHaveURL(/\/villages\/[0-9a-f-]{36}/);
    await followerPage.goto('/profil/notifications');
    await followerPage.getByLabel('Recevoir aussi les informations non vérifiées').check();
    await followerPage.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(followerPage.getByText('Enregistré')).toBeVisible();

    // Filtre de recherche de la file : le test ne dépend pas des autres signalements en attente.
    await signIn(
      page,
      admin.email,
      admin.password,
      `/admin/moderation?q=${encodeURIComponent(reportDescription)}`,
    );
    await expect(page.getByText(reportDescription)).toBeVisible();
    const card = page.locator('li.card', { hasText: reportDescription });
    await card.getByRole('button', { name: 'Valider' }).click();
    // Une fois traité, le signalement sort de la file de modération.
    await expect(page.getByText(reportDescription)).toHaveCount(0);

    // Publication visible par un visiteur, avec statut et avertissement.
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto('/alertes');
    await visitor
      .getByRole('link', { name: /Fumée signalée/ })
      .first()
      .click();
    await expect(visitor.getByText('En cours de vérification').first()).toBeVisible();
    await expect(visitor.getByText(/Information en cours de vérification/)).toBeVisible();
    await expect(visitor.getByText(reportDescription)).toHaveCount(0); // le texte brut n'est pas publié

    // Le traitement de l'outbox (déclenché après la décision) crée la notification in-app.
    await expect(async () => {
      await followerPage.goto('/notifications');
      await expect(followerPage.getByText(/Fumée signalée/).first()).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });
  });
});
