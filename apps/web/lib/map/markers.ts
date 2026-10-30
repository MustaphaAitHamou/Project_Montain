'use client';

import type { Map as MaplibreMap } from 'maplibre-gl';
import { CATEGORIES, type DisplayClass } from '@tamurt/shared';
import { displayClassStyles } from '@tamurt/shared/theme';
import { iconSvgFor } from '@/components/ui/CategoryIcon';

const PIXEL_RATIO = 2;

function svgToImageData(svg: string, size: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image(size * PIXEL_RATIO, size * PIXEL_RATIO);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size * PIXEL_RATIO;
      canvas.height = size * PIXEL_RATIO;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.onerror = () => reject(new Error('marker image'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function markerSvg(color: string, iconMarkup: string, displayClass: DisplayClass): string {
  const style = displayClassStyles[displayClass];
  const dash = style.dashed ? ' stroke-dasharray="4 3"' : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 40 40">` +
    `<circle cx="20" cy="20" r="16.5" fill="${color}" fill-opacity="${style.opacity}" stroke="${style.strokeColor}" stroke-width="${style.strokeWidth}"${dash}/>` +
    `<g transform="translate(9 9) scale(0.9167)" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${iconMarkup}</g>` +
    `</svg>`
  );
}

function hotspotSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">` +
    `<rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" fill="#FF7043" stroke="#7C2D12" stroke-width="2"/>` +
    `<circle cx="12" cy="12" r="2.5" fill="#7C2D12"/></svg>`
  );
}

function clusterSvg(count: string): string {
  const width = count.length > 2 ? 52 : 44;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="88" viewBox="0 0 ${width} 44">` +
    `<rect x="2" y="2" width="${width - 4}" height="40" rx="20" fill="#153D30" stroke="#FFFFFF" stroke-width="3"/>` +
    `<text x="${width / 2}" y="28" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="#FFFFFF">${count}</text>` +
    `</svg>`
  );
}

export const MARKER_DISPLAY_CLASSES: DisplayClass[] = ['unverified', 'community', 'institutional'];

export function markerImageId(categoryId: string, displayClass: DisplayClass): string {
  return `marker-${categoryId}-${displayClass}`;
}

/** Ajoute à la carte les images de marqueurs (catégorie × provenance), sans police distante. */
export async function registerMarkerImages(map: MaplibreMap): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const category of CATEGORIES) {
    for (const displayClass of MARKER_DISPLAY_CLASSES) {
      const id = markerImageId(category.id, displayClass);
      if (map.hasImage(id)) continue;
      jobs.push(
        svgToImageData(markerSvg(category.color, iconSvgFor(category.icon), displayClass), 40).then(
          (data) => {
            if (!map.hasImage(id)) map.addImage(id, data, { pixelRatio: PIXEL_RATIO });
          },
        ),
      );
    }
  }
  if (!map.hasImage('marker-hotspot')) {
    jobs.push(
      svgToImageData(hotspotSvg(), 24).then((data) => {
        if (!map.hasImage('marker-hotspot'))
          map.addImage('marker-hotspot', data, { pixelRatio: PIXEL_RATIO });
      }),
    );
  }
  await Promise.allSettled(jobs);
}

/** Les compteurs de grappes sont rendus en images à la demande (pas de glyphes nécessaires). */
export function handleMissingClusterImages(map: MaplibreMap): void {
  map.on('styleimagemissing', (e: { id: string }) => {
    if (!e.id.startsWith('cluster-')) return;
    const label = e.id.slice('cluster-'.length);
    const width = label.length > 2 ? 52 : 44;
    void svgToImageData(clusterSvg(label), width).then((data) => {
      if (!map.hasImage(e.id)) map.addImage(e.id, data, { pixelRatio: PIXEL_RATIO });
    });
  });
}
