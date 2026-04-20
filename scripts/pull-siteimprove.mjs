#!/usr/bin/env node
/**
 * Pull Sites & Pages from Siteimprove API
 * Fetches all sites and their crawled pages, then merges into sites-data1.json.
 * Only ADDS new sites/pages — never removes existing ones.
 *
 * Usage:
 *   node scripts/pull-siteimprove.mjs               # pull and merge
 *   node scripts/pull-siteimprove.mjs --dry-run      # show what would be added
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// Load .env manually (no dotenv dependency)
function loadEnv(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv(resolve(ROOT, '.env.local'));
loadEnv(resolve(ROOT, '.env'));

const EMAIL = process.env.SITEIMPROVE_EMAIL;
const API_KEY = process.env.SITEIMPROVE_API_KEY;
const BASE_URL = 'https://api.eu.siteimprove.com/v2';

if (!EMAIL || !API_KEY) {
  console.error('Missing SITEIMPROVE_EMAIL or SITEIMPROVE_API_KEY in .env');
  process.exit(1);
}

const AUTH = 'Basic ' + Buffer.from(`${EMAIL}:${API_KEY}`).toString('base64');

async function apiGet(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: AUTH, Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Siteimprove ${res.status}: ${text.substring(0, 200)}`);
  }
  return res.json();
}

// Sites to exclude from pull (not part of CoE dashboard)
const EXCLUDED_URLS = [
  'citt.it.ufl.edu',
  'ceecs.education.ufl.edu',
  'UFLI.education.ufl.edu',
];

// ── Fetch all sites ──────────────────────────────────────────
console.log('Fetching sites from Siteimprove...');
const sitesData = await apiGet('/sites?page_size=100');
const allSiSites = sitesData.items || [];
const siSites = allSiSites.filter(s => !EXCLUDED_URLS.some(ex => (s.url || '').includes(ex)));
const skipped = allSiSites.length - siSites.length;
console.log(`Found ${allSiSites.length} sites in Siteimprove account${skipped ? ` (skipping ${skipped} excluded)` : ''}\n`);

// ── Fetch crawled pages for each site ────────────────────────
async function fetchSitePages(siteId, siteName) {
  const allPages = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 100) {
    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const data = await apiGet(`/sites/${siteId}/content/pages?page_size=100&page=${page}`);
        if (data.items) {
          allPages.push(...data.items);
        }
        totalPages = data.total_pages || 1;
        success = true;
        break;
      } catch (err) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        } else {
          console.log(`  Warning: failed page ${page} for ${siteName} after 3 retries: ${err.message}`);
        }
      }
    }
    if (!success) {
      // Skip this page and continue to next
      page++;
      continue;
    }
    page++;
    if (page <= totalPages) await new Promise(r => setTimeout(r, 500));
  }
  return allPages;
}

// ── Load existing sites-data1.json ───────────────────────────
const sitesDataPath = resolve(ROOT, 'public/sites-data1.json');
let existing = { description: 'Sites data with Siteimprove pages', lastUpdated: '', subsites: [] };
if (existsSync(sitesDataPath)) {
  existing = JSON.parse(readFileSync(sitesDataPath, 'utf-8'));
}

const existingSiteMap = new Map();
for (const site of existing.subsites) {
  existingSiteMap.set(site.id, site);
}
const existingUrlSet = new Set();
for (const site of existing.subsites) {
  for (const p of site.pages || []) {
    existingUrlSet.add(p.url);
  }
}

const beforeSiteCount = existing.subsites.length;
const beforePageCount = existingUrlSet.size;

// ── Process each Siteimprove site ────────────────────────────
let newSitesAdded = 0;
let newPagesAdded = 0;
let sitesProcessed = 0;

for (const si of siSites) {
  sitesProcessed++;
  const siteUrl = si.url?.replace(/\/?$/, '/') || '';
  if (!siteUrl) continue;

  // Create a site ID from URL (match existing convention)
  const siteId = siteUrl
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase();

  console.log(`[${sitesProcessed}/${siSites.length}] ${si.site_name} (${siteUrl})`);

  // Fetch all crawled pages
  const siPages = await fetchSitePages(si.id, si.site_name);
  console.log(`  → ${siPages.length} pages crawled`);

  // Check if site already exists
  let siteEntry = existingSiteMap.get(siteId);
  const isNewSite = !siteEntry;

  if (!siteEntry) {
    siteEntry = {
      id: siteId,
      baseUrl: siteUrl,
      title: si.site_name || siteUrl,
      isLive: true,
      pages: [],
    };
    existing.subsites.push(siteEntry);
    existingSiteMap.set(siteId, siteEntry);
    newSitesAdded++;
  }

  // Merge pages
  const existingPagesInSite = new Set(siteEntry.pages.map(p => p.url));
  let addedForSite = 0;

  for (const siPage of siPages) {
    const pageUrl = siPage.url || '';
    if (!pageUrl) continue;
    // Only add if not already in this site AND not seen globally
    if (!existingPagesInSite.has(pageUrl) && !existingUrlSet.has(pageUrl)) {
      const path = pageUrl.replace(siteUrl, '/').replace(/\/\//g, '/') || '/';
      const title = siPage.title || path.replace(/\//g, ' ').trim() || 'Untitled';
      siteEntry.pages.push({ path, title, url: pageUrl });
      existingPagesInSite.add(pageUrl);
      existingUrlSet.add(pageUrl);
      addedForSite++;
      newPagesAdded++;
    }
  }

  if (addedForSite > 0 || isNewSite) {
    console.log(`  → Added ${addedForSite} new pages ${isNewSite ? '(NEW SITE)' : ''}`);
  }
}

// ── Summary ──────────────────────────────────────────────────
console.log(`\n${'='.repeat(60)}`);
console.log(`SUMMARY`);
console.log(`${'='.repeat(60)}`);
console.log(`Sites before: ${beforeSiteCount} → after: ${existing.subsites.length} (+${newSitesAdded} new)`);
console.log(`Pages before: ${beforePageCount} → after: ${existingUrlSet.size} (+${newPagesAdded} new)`);
console.log(`${'='.repeat(60)}\n`);

if (DRY_RUN) {
  console.log('DRY RUN — no files modified. Re-run without --dry-run to save.');
  process.exit(0);
}

// ── Save ─────────────────────────────────────────────────────
existing.lastUpdated = new Date().toISOString().split('T')[0];
writeFileSync(sitesDataPath, JSON.stringify(existing, null, 2) + '\n');
console.log(`Saved updated sites-data1.json`);
console.log('Done!');
