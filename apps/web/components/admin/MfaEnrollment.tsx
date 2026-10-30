'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Activation de la double authentification TOTP (Supabase Auth MFA).
 * Après vérification, la session passe au niveau aal2 exigé pour l'administration.
 */
export function MfaEnrollment() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const enroll = async () => {
    setMessage(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Tamurt Alerte ${new Date().toISOString().slice(0, 10)}`,
    });
    if (error || !data) {
      setMessage(error?.message ?? 'Erreur');
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
  };

  const verify = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !factorId) return;
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setMessage(
      error
        ? `Code refusé : ${error.message}`
        : 'Double authentification activée. Session de niveau aal2.',
    );
  };

  const elevate = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp?.[0];
    if (!factor) {
      setMessage('Aucun facteur TOTP vérifié.');
      return;
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: code.trim(),
    });
    setMessage(error ? `Code refusé : ${error.message}` : 'Session élevée au niveau aal2.');
  };

  return (
    <div className="stack-sm">
      {!factorId && (
        <button type="button" className="btn btn-primary" onClick={() => void enroll()}>
          Activer la double authentification (nouvel appareil)
        </button>
      )}
      {qr && (
        <div className="stack-sm">
          {/* QR code SVG fourni par Supabase Auth (data URL). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="QR code TOTP"
            width={200}
            height={200}
            style={{ background: '#fff', padding: 8 }}
          />
          <p className="small">
            Clé manuelle : <code>{secret}</code>
          </p>
        </div>
      )}
      <div className="row">
        <label htmlFor="mfa-code">Code à 6 chiffres</label>
        <input
          id="mfa-code"
          className="input"
          style={{ maxWidth: 140 }}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => void (factorId ? verify() : elevate())}
        >
          Vérifier
        </button>
      </div>
      {message && (
        <p className="small" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
