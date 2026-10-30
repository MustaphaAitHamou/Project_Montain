'use client';

/**
 * Ré-encode une image dans le navigateur (canvas → JPEG). Effet de bord voulu :
 * les métadonnées EXIF (dont la position GPS) ne sont PAS recopiées.
 * Le serveur ré-encode de nouveau l'image avant toute publication (défense en profondeur).
 */
export async function reencodeImage(
  file: File,
  maxDimension = 1600,
  quality = 0.85,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encode'))),
      'image/jpeg',
      quality,
    );
  });
}
