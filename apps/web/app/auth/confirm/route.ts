import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/auth';

const ALLOWED_TYPES: EmailOtpType[] = ['email', 'signup', 'recovery', 'email_change'];

/**
 * Lien reçu par e-mail (confirmation d'inscription, réinitialisation du mot de passe).
 * Le jeton à usage unique est vérifié côté serveur, puis la session est posée en cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = safeNextPath(
    searchParams.get('next'),
    type === 'recovery' ? '/reinitialiser-mot-de-passe' : '/',
  );

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) {
        const target = new URL(next, origin);
        if (type !== 'recovery') target.searchParams.set('bienvenue', '1');
        return NextResponse.redirect(target);
      }
    }
  }
  return NextResponse.redirect(new URL('/connexion?erreur=lien', origin));
}
