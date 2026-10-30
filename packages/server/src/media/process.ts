import sharp from 'sharp';

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
  contentType: 'image/webp';
}

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

/**
 * Ré-encode une photo avant publication :
 * - vérifie le vrai format (octets) et non le type déclaré ;
 * - borne la taille décodée (protection contre les « bombes » de décompression) ;
 * - applique l'orientation EXIF puis SUPPRIME toutes les métadonnées (EXIF dont GPS, XMP, ICC) :
 *   sharp n'écrit aucune métadonnée en sortie sans appel explicite à withMetadata()/keepExif().
 */
export async function processImageForPublication(
  input: Buffer,
  maxDimension = 1600,
): Promise<ProcessedImage> {
  const image = sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 });
  const metadata = await image.metadata();
  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new Error('unsupported_image_format');
  }
  if (!metadata.width || !metadata.height || metadata.width < 32 || metadata.height < 32) {
    throw new Error('image_too_small');
  }
  const { data, info } = await image
    .rotate()
    .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, contentType: 'image/webp' };
}
