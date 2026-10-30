import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { processImageForPublication } from './process';

async function jpegWithExif(): Promise<Buffer> {
  return sharp({ create: { width: 800, height: 600, channels: 3, background: '#2d7b57' } })
    .jpeg()
    .withExif({
      IFD0: { Make: 'TestCamera', Model: 'TamurtTest', Copyright: 'Métadonnée à supprimer' },
    })
    .toBuffer();
}

describe('traitement des photos avant publication', () => {
  it('supprime toutes les métadonnées EXIF et ré-encode en WebP', async () => {
    const input = await jpegWithExif();
    const before = await sharp(input).metadata();
    expect(before.exif).toBeDefined();

    const output = await processImageForPublication(input);
    const after = await sharp(output.data).metadata();
    expect(after.format).toBe('webp');
    expect(after.exif).toBeUndefined();
    expect(after.xmp).toBeUndefined();
    expect(after.icc).toBeUndefined();
    expect(output.data.includes(Buffer.from('TamurtTest'))).toBe(false);
  });

  it('réduit les grandes images sans les agrandir', async () => {
    const big = await sharp({
      create: { width: 4000, height: 2000, channels: 3, background: '#000' },
    })
      .png()
      .toBuffer();
    const out = await processImageForPublication(big);
    expect(out.width).toBe(1600);
    expect(out.height).toBe(800);
    const small = await sharp({
      create: { width: 200, height: 100, channels: 3, background: '#000' },
    })
      .jpeg()
      .toBuffer();
    expect((await processImageForPublication(small)).width).toBe(200);
  });

  it('refuse un fichier qui n’est pas une image (type déclaré ignoré)', async () => {
    await expect(
      processImageForPublication(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).rejects.toThrow();
    await expect(processImageForPublication(Buffer.from('%PDF-1.4 fake'))).rejects.toThrow();
  });
});
