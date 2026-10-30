/**
 * Rôles applicatifs attribués explicitement (table `user_roles`).
 * « Visiteur » (non connecté) et « Utilisateur inscrit » sont implicites.
 * Aucun rôle n'est attribué automatiquement à partir du nombre de publications :
 * la réputation peut seulement SUGGÉRER un contributeur fiable, un administrateur décide.
 */
export const APP_ROLES = ['trusted_contributor', 'moderator', 'admin', 'partner'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export type Actor =
  | { kind: 'visitor' }
  | { kind: 'user'; userId: string; roles: readonly AppRole[]; mfaVerified?: boolean };

export const PERMISSIONS = [
  'alerts.read_public',
  'report.create',
  'places.follow',
  'event.add_verification',
  'report.moderate',
  'event.update_status',
  'event.confirm',
  'media.moderate',
  'appeal.decide',
  'roles.manage',
  'sources.manage',
  'settings.manage',
  'audit.read',
  'notifications.test',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  trusted_contributor: ['event.add_verification'],
  partner: ['event.add_verification', 'event.confirm'],
  moderator: [
    'event.add_verification',
    'report.moderate',
    'event.update_status',
    'event.confirm',
    'media.moderate',
    'appeal.decide',
  ],
  admin: [
    'event.add_verification',
    'report.moderate',
    'event.update_status',
    'event.confirm',
    'media.moderate',
    'appeal.decide',
    'roles.manage',
    'sources.manage',
    'settings.manage',
    'audit.read',
    'notifications.test',
  ],
};

const USER_PERMISSIONS: readonly Permission[] = [
  'alerts.read_public',
  'report.create',
  'places.follow',
];

/** Permissions sensibles pour lesquelles le MFA administrateur peut être exigé. */
export const MFA_SENSITIVE_PERMISSIONS: readonly Permission[] = [
  'roles.manage',
  'sources.manage',
  'settings.manage',
];

/**
 * Vérification de permission côté application (affichage, garde de route).
 * ATTENTION : ce n'est qu'un confort d'interface — l'autorisation réelle est
 * toujours contrôlée par la base (RLS, fonctions SECURITY DEFINER) et les routes serveur.
 */
export function can(actor: Actor, permission: Permission): boolean {
  if (actor.kind === 'visitor') return permission === 'alerts.read_public';
  if (USER_PERMISSIONS.includes(permission)) return true;
  return actor.roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}

export function isStaff(roles: readonly AppRole[]): boolean {
  return roles.includes('moderator') || roles.includes('admin');
}
