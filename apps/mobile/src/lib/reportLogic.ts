/** Choix d'heure d'observation proposés (en minutes avant maintenant), bornés par la catégorie. */
const PRESETS_MINUTES = [0, 15, 30, 60, 180, 360, 720, 1440, 2880, 10080];

export function observedPresetMinutes(maxObservedAgeHours: number): number[] {
  return PRESETS_MINUTES.filter((m) => m <= maxObservedAgeHours * 60);
}

export function observedAtIso(minutesAgo: number, now: number): string {
  return new Date(now - minutesAgo * 60_000).toISOString();
}

/** Chemin de stockage en quarantaine : <utilisateur>/<signalement>/<fichier> (imposé par la RLS). */
export function quarantinePath(userId: string, reportId: string, fileId: string): string {
  return `${userId}/${reportId}/${fileId}.jpg`;
}
