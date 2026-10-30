'use client';

import { useActionState, type ReactNode } from 'react';
import type { AdminResult } from '@/app/actions/admin';

const ERROR_LABELS: Record<string, string> = {
  forbidden: 'Action non autorisée pour votre rôle.',
  mfa_required: 'Double authentification requise (session aal2).',
  invalid: 'Données invalides.',
  reason_required: 'Une justification (3 caractères minimum) est obligatoire.',
  severity_exceeds_status_cap: 'Gravité trop élevée pour ce statut (plafond appliqué par la base).',
  invalid_status_transition: 'Transition de statut non autorisée.',
  report_not_pending: 'Ce signalement a déjà été traité.',
  category_mismatch: 'La catégorie ne correspond pas à l’événement choisi.',
  event_not_found: 'Événement introuvable ou clos.',
  last_admin: 'Impossible de retirer le dernier administrateur.',
  personal_contact_not_allowed: 'La note publique contient des coordonnées personnelles.',
  self_moderation_forbidden:
    'Vous avez contribué à ce signalement ou à cet événement : un autre membre de l’équipe doit le traiter.',
};

/** Formulaire d'administration avec retour visible (succès / erreur traduite). */
export function ActionForm({
  action,
  children,
  submitLabel,
  className,
  danger = false,
}: {
  action: (prev: AdminResult | null, formData: FormData) => Promise<AdminResult>;
  children: ReactNode;
  submitLabel: string;
  className?: string;
  danger?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className ?? 'stack-sm'}>
      {children}
      {state?.ok && (
        <p className="small" role="status" style={{ color: 'var(--color-success)' }}>
          ✓ Enregistré
        </p>
      )}
      {state && !state.ok && (
        <p className="error" role="alert">
          {ERROR_LABELS[state.error ?? ''] ?? 'Erreur. Réessayez.'}
        </p>
      )}
      <button
        type="submit"
        className={danger ? 'btn btn-sm btn-outline' : 'btn btn-sm btn-primary'}
        disabled={pending}
      >
        {submitLabel}
      </button>
    </form>
  );
}
