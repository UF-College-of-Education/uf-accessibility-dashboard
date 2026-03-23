#!/usr/bin/env node
/**
 * WordPress Theme Detector — checks each site's baseUrl HTML for Divi or Enfold theme markers.
 * Output: public/theme-data.json
 *
 * Usage: node scripts/detect-themes.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CONCURRENCY = 10;

// Load all 3 data sources
const sites1Path = resolve(ROOT, 'public/sites-data1.json');
const sites2Path = resolve(ROOT, 'public/sites-data.json');
const noahUrl = 'https://raw.githubusercontent.com/noah-n-pham/uf-web-mapper/main/public/data.json';

const sites1 = JSON.parse(readFileSync(sites1Path, 'utf-8')).subsites || [];
let sites2 = [];
if (existsSync(sites2Path)) {
  try { sites2 = JSON.parse(readFileSync(sites2Path, 'utf-8')).subsites || []; } catch {}
}

let noahSites = [];
try {
  console.log('Fetching Noah\'s web mapper data...');
  const res = await fetch(noahUrl, { signal: AbortSignal.timeout(15000) });
  if (res.ok) {
    const data = await res.json();
    noahSites = data.subsites || [];
    console.log(`  Found ${noahSites.length} sites from Noah's data`);
  }
} catch (err) {
  console.log(`  Could not fetch Noah's data: ${err.message}`);
}

// Merge sites by id
const sites = [...sites1];
const seenIds = new Set(sites1.map(s => s.id));
for (const site of [...sites2, ...noahSites]) {
  if (!seenIds.has(site.id)) {
    sites.push(site);
    seenIds.add(site.id);
  }
}

console.log(`Checking ${sites.length} sites for Divi/Enfold themes...\n`);

const results = {};

async function detectTheme(site) {
  const url = site.baseUrl;
  if (!url) return;

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThemeDetector/1.0)' },
    });
    if (!res.ok) {
      results[site.id] = { url, theme: null, error: `HTTP ${res.status}` };
      return;
    }

    const html = await res.text();
    const htmlLower = html.toLowerCase();

    // Divi detection: look for Divi theme or Divi Builder markers
    const isDivi = htmlLower.includes('/divi/') ||
      htmlLower.includes('divi-engine') ||
      htmlLower.includes('et_divi') ||
      htmlLower.includes('class="et_pb_') ||
      htmlLower.includes('et-boc') ||
      htmlLower.includes('/et-core/') ||
      htmlLower.includes('themes/divi');

    // Enfold detection: look for Enfold theme markers
    const isEnfold = htmlLower.includes('/enfold/') ||
      htmlLower.includes('themes/enfold') ||
      htmlLower.includes('avia-') ||
      htmlLower.includes('av_default') ||
      htmlLower.includes('class="avia_') ||
      htmlLower.includes('av-layout-grid') ||
      htmlLower.includes('kriesi.at');

    let theme = null;
    if (isDivi) theme = 'divi';
    else if (isEnfold) theme = 'enfold';

    results[site.id] = { url, theme };
  } catch (err) {
    results[site.id] = { url, theme: null, error: err.message?.substring(0, 60) };
  }
}

// Run in batches
const start = Date.now();
for (let i = 0; i < sites.length; i += CONCURRENCY) {
  const batch = sites.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(s => detectTheme(s)));

  const done = Math.min(i + CONCURRENCY, sites.length);
  const diviCount = Object.values(results).filter(r => r.theme === 'divi').length;
  const enfoldCount = Object.values(results).filter(r => r.theme === 'enfold').length;
  console.log(`[${done}/${sites.length}] Divi: ${diviCount}, Enfold: ${enfoldCount}`);
}

const elapsed = Math.round((Date.now() - start) / 1000);

// Summary
const diviSites = Object.entries(results).filter(([, r]) => r.theme === 'divi');
const enfoldSites = Object.entries(results).filter(([, r]) => r.theme === 'enfold');

console.log(`\n${'='.repeat(50)}`);
console.log(`Done in ${elapsed}s`);
console.log(`Divi sites: ${diviSites.length}`);
for (const [id, r] of diviSites) console.log(`  - ${id}: ${r.url}`);
console.log(`Enfold sites: ${enfoldSites.length}`);
for (const [id, r] of enfoldSites) console.log(`  - ${id}: ${r.url}`);
console.log(`Other/unknown: ${Object.values(results).filter(r => !r.theme).length}`);

// Save
const output = {
  lastChecked: new Date().toISOString(),
  totalSites: sites.length,
  themes: results,
};

const outPath = resolve(ROOT, 'public/theme-data.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nSaved to public/theme-data.json`);
