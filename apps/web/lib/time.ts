/** Instant ISO situé `hours` heures dans le passé (utilisable dans les composants serveur). */
export function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}
