import { router } from 'expo-router';
import { Card, Screen, Title } from '@/components/Screen';
import { Button, Loading, Muted } from '@/components/ui';
import { Disclaimer, QueueBanner } from '@/components/Banners';
import { ReportWizard } from '@/components/report/ReportWizard';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

export default function SignalerScreen() {
  const { t } = useI18n();
  const { userId, loading } = useAuth();
  return (
    <Screen>
      <Title>{t('report.title')}</Title>
      <Muted>{t('report.intro')}</Muted>
      <QueueBanner />
      {loading ? (
        <Loading label={t('common.loading')} />
      ) : userId ? (
        <ReportWizard userId={userId} />
      ) : (
        <Card>
          <Muted>{t('mobile.signInToReport')}</Muted>
          <Button label={t('common.signIn')} onPress={() => router.push('/connexion')} />
          <Button
            variant="outline"
            label={t('common.signUp')}
            onPress={() => router.push('/inscription')}
          />
        </Card>
      )}
      <Disclaimer />
    </Screen>
  );
}
