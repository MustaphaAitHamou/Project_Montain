#!/usr/bin/env node
/**
 * MapLibre GL JS v6 charge son worker (module ES autonome) comme fichier voisin du bundle.
 * Une fois l'application bundlée par Next.js, ce fichier doit être servi explicitement :
 * on le copie dans public/maplibre/<version>/ et l'application appelle setWorkerUrl().
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pkgPath = require.resolve('maplibre-gl/package.json');
const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));
const source = join(dirname(pkgPath), 'dist', 'maplibre-gl-worker.mjs');
const targetDir = join(appRoot, 'public', 'maplibre', version);
mkdirSync(targetDir, { recursive: true });
copyFileSync(source, join(targetDir, 'maplibre-gl-worker.mjs'));
console.info(`Worker MapLibre ${version} copié dans public/maplibre/${version}/`);
