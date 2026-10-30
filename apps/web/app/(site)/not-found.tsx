import Link from 'next/link';
import { getI18n } from '@/lib/i18n';

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="page container stack" id="contenu" style={{ maxWidth: 560 }}>
      <h1>{t('errors.notFound')}</h1>
      <p className="muted">{t('event.notFound')}</p>
      <Link href="/" className="btn btn-primary">
        {t('nav.home')}
      </Link>
    </main>
  );
}
