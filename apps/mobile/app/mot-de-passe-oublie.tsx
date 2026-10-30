import { Screen } from '@/components/Screen';
import { AuthForm } from '@/components/AuthForm';

export default function AuthScreen() {
  return (
    <Screen>
      <AuthForm mode="reset" />
    </Screen>
  );
}
