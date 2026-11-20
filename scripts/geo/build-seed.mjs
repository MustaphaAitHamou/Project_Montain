#!/usr/bin/env node
/**
 * Génère la migration SQL du référentiel géographique (wilayas + communes avec contours)
 * à partir du paquet `dz-geodata` (données OpenStreetMap, licence ODbL 1.0).
 *
 * Usage :
 *   node scripts/geo/build-seed.mjs                 # wilayas par défaut (Kabylie)
 *   node scripts/geo/build-seed.mjs 15 06 10        # wilayas choisies (codes ONS)
 *   node scripts/geo/build-seed.mjs --all           # toutes les wilayas de dz-geodata
 *   node scripts/geo/build-seed.mjs --except 15,06  # wilayas à exclure (déjà importées)
 *   node scripts/geo/build-seed.mjs --region <id>   # région de rattachement (défaut : kabylie)
 *   node scripts/geo/build-seed.mjs --out <fichier> # chemin de sortie
 *
 * Couverture nationale (migration 20261120090100_geo_algeria_data.sql) :
 *   node scripts/geo/build-seed.mjs --all --except 15,06,10,35,34,19 --region algerie \
 *     --out supabase/migrations/20261120090100_geo_algeria_data.sql
 *
 * Le fichier produit est idempotent (upsert) : il peut être rejoué pour mettre à jour
 * les contours ou étendre la couverture à d'autres wilayas. La région doit exister
 * (table public.regions) avant l'exécution du fichier.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = join(repoRoot, 'node_modules', 'dz-geodata', 'data');
const pkg = JSON.parse(
  readFileSync(join(repoRoot, 'node_modules', 'dz-geodata', 'package.json'), 'utf8'),
);

const DEFAULT_WILAYAS = ['15', '06', '10', '35', '34', '19'];

const args = process.argv.slice(2);
let out = join(repoRoot, 'supabase', 'migrations', '20261030101000_geo_reference_data.sql');
let regionId = 'kabylie';
let all = false;
const codes = [];
const excluded = new Set();
const valueOf = (i) => {
  const value = args[i + 1];
  if (!value || value.startsWith('--')) {
    console.error(`Valeur manquante pour ${args[i]}`);
    process.exit(1);
  }
  return value;
};
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--out') {
    out = resolve(valueOf(i));
    i += 1;
  } else if (args[i] === '--region') {
    regionId = valueOf(i);
    if (!/^[a-z][a-z0-9_]{1,40}$/.test(regionId)) {
      console.error(`Identifiant de région invalide : ${regionId}`);
      process.exit(1);
    }
    i += 1;
  } else if (args[i] === '--except') {
    for (const code of valueOf(i).split(',')) excluded.add(code.trim());
    i += 1;
  } else if (args[i] === '--all') {
    all = true;
  } else if (/^\d{2}$/.test(args[i])) {
    codes.push(args[i]);
  } else {
    console.error(`Argument invalide : ${args[i]}`);
    process.exit(1);
  }
}

const read = (name) => JSON.parse(readFileSync(join(dataDir, name), 'utf8'));
const provenance = read('provenance.json');
const wilayasGeo = read('wilayas.geojson');
const communesGeo = read('communes.geojson');
const dairas = read('dairas.json');

const requested = all
  ? wilayasGeo.features.map((f) => f.properties.code).sort()
  : codes.length > 0
    ? codes
    : DEFAULT_WILAYAS;
const wilayaCodes = requested.filter((code) => !excluded.has(code));
if (wilayaCodes.length === 0) {
  console.error('Aucune wilaya à importer.');
  process.exit(1);
}

const dairaById = new Map(dairas.map((d) => [d.osm_id, d]));

/** Littéral SQL échappé (ou NULL). */
function lit(value) {
  if (value === null || value === undefined || value === '') return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function geom(geometry) {
  const json = JSON.stringify(geometry);
  return (
    'extensions.st_multi(extensions.st_collectionextract(extensions.st_makevalid(' +
    `extensions.st_setsrid(extensions.st_geomfromgeojson(${lit(json)}), 4326)), 3))`
  );
}

const wilayaFeatures = wilayasGeo.features.filter((f) => wilayaCodes.includes(f.properties.code));
const missing = wilayaCodes.filter((c) => !wilayaFeatures.some((f) => f.properties.code === c));
if (missing.length > 0) {
  console.error(`Wilayas introuvables dans dz-geodata : ${missing.join(', ')}`);
  process.exit(1);
}
/*
 * Codes ONS absents de l'extrait OSM, complétés d'après la nomenclature officielle des
 * communes (ONS). Clé : identifiant de la relation OSM. Seul cas connu : Aïn Defla, chef-lieu
 * de la wilaya 44, code 4401 (seul code manquant de la série 4401–4436).
 */
const ONS_CODE_OVERRIDES = new Map([[21037899, '4401']]);

const communeFeatures = communesGeo.features
  .filter((f) => wilayaCodes.includes(f.properties.wilaya_code))
  .map((f) => {
    const onsCode = f.properties.ons_code ?? ONS_CODE_OVERRIDES.get(f.properties.osm_id) ?? null;
    if (!onsCode) {
      console.error(
        `Commune sans code ONS : ${f.properties.name_fr} (OSM ${f.properties.osm_id}). ` +
          'Compléter ONS_CODE_OVERRIDES avec le code officiel.',
      );
      process.exit(1);
    }
    return { ...f, properties: { ...f.properties, ons_code: onsCode } };
  })
  .sort((a, b) => a.properties.ons_code.localeCompare(b.properties.ons_code));

const lines = [];
lines.push('-- =====================================================================');
lines.push('-- FICHIER GÉNÉRÉ par scripts/geo/build-seed.mjs — ne pas modifier à la main.');
lines.push(`-- Source : ${pkg.name} ${pkg.version} — ${provenance.source}`);
lines.push(`-- Extrait du ${provenance.extract_date} (sha256 ${provenance.extract_sha256})`);
lines.push(`-- Licence des données : ${provenance.license} — ${provenance.attribution}`);
lines.push(`-- Région : ${regionId} — wilayas : ${wilayaCodes.join(', ')}`);
lines.push(`-- ${wilayaFeatures.length} wilayas, ${communeFeatures.length} communes`);
lines.push('-- =====================================================================');
lines.push('');

for (const f of wilayaFeatures) {
  const p = f.properties;
  lines.push(
    'insert into public.wilayas (code, region_id, name_fr, name_ar, name_en, boundary, osm_id, wikidata, data_source)',
  );
  lines.push(
    `values (${lit(p.code)}, ${lit(regionId)}, ${lit(p.name_fr)}, ${lit(p.name_ar)}, ${lit(p.name_en)},`,
  );
  lines.push(`  ${geom(f.geometry)},`);
  lines.push(`  ${lit(p.osm_id)}, ${lit(p.wikidata)}, ${lit(`osm:${pkg.name}@${pkg.version}`)})`);
  lines.push(
    'on conflict (code) do update set region_id = excluded.region_id, name_fr = excluded.name_fr,',
  );
  lines.push(
    '  name_ar = excluded.name_ar, name_en = excluded.name_en, boundary = excluded.boundary,',
  );
  lines.push(
    '  osm_id = excluded.osm_id, wikidata = excluded.wikidata, data_source = excluded.data_source,',
  );
  lines.push('  updated_at = now();');
  lines.push('');
}

lines.push(
  'update public.wilayas set centroid = extensions.st_pointonsurface(boundary)::extensions.geography',
);
lines.push(`where code in (${wilayaCodes.map(lit).join(', ')});`);
lines.push('');

for (const f of communeFeatures) {
  const p = f.properties;
  const daira = dairaById.get(p.daira_osm_id);
  lines.push(
    'insert into public.communes (code, wilaya_code, name_fr, name_ar, name_en, daira_name_fr, daira_name_ar,',
  );
  lines.push('  population, boundary, centroid, osm_id, wikidata, data_source)');
  lines.push(
    `select ${lit(p.ons_code)}, ${lit(p.wilaya_code)}, ${lit(p.name_fr)}, ${lit(p.name_ar)}, ${lit(p.name_en)},`,
  );
  lines.push(`  ${lit(daira?.name_fr)}, ${lit(daira?.name_ar)}, ${lit(p.population)},`);
  lines.push('  g.geom, extensions.st_pointonsurface(g.geom)::extensions.geography,');
  lines.push(`  ${lit(p.osm_id)}, ${lit(p.wikidata)}, ${lit(`osm:${pkg.name}@${pkg.version}`)}`);
  lines.push(`from (select ${geom(f.geometry)} as geom) g`);
  lines.push(
    'on conflict (code) do update set wilaya_code = excluded.wilaya_code, name_fr = excluded.name_fr,',
  );
  lines.push(
    '  name_ar = excluded.name_ar, name_en = excluded.name_en, daira_name_fr = excluded.daira_name_fr,',
  );
  lines.push('  daira_name_ar = excluded.daira_name_ar, population = excluded.population,');
  lines.push(
    '  boundary = excluded.boundary, centroid = excluded.centroid, osm_id = excluded.osm_id,',
  );
  lines.push(
    '  wikidata = excluded.wikidata, data_source = excluded.data_source, updated_at = now();',
  );
  lines.push('');
}

lines.push('update public.regions r');
lines.push('set bbox = (select extensions.st_envelope(extensions.st_union(w.boundary))');
lines.push('            from public.wilayas w where w.region_id = r.id)');
lines.push(`where r.id = ${lit(regionId)};`);
lines.push('');

writeFileSync(out, `${lines.join('\n')}`);
console.info(
  `Écrit ${out} : ${wilayaFeatures.length} wilayas, ${communeFeatures.length} communes (${provenance.license}).`,
);
