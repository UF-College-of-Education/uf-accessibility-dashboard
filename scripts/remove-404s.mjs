#!/usr/bin/env node
/**
 * Check 404 Pages Script
 * Checks all pages in sites-data1.json via HTTP HEAD requests (no Chrome needed).
 * Marks 404 pages in lighthouse-scores.json with status: 404.
 * The dashboard auto-reads this and marks them as "404" status.
 *
 * Usage:
 *   node scripts/remove-404s.mjs            # run and mark 404s
 *   node scripts/remove-404s.mjs --dry-run  # show what would be marked
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = 10;

const outputPath = resolve(ROOT, 'public/404-pages.json');

// ── Load ALL data sources (same as DataService.ts) ─────────
const seenUrls = new Set();
const allUrls = [];

function addPages(filePath) {
  if (!existsSync(filePath)) return;
  const data = JSON.parse(readFileSync(filePath, 'utf-8'));
  const sites = data.subsites || [data];
  for (const site of sites) {
    for (const page of site.pages || []) {
      if (page.url && !seenUrls.has(page.url)) {
        seenUrls.add(page.url);
        allUrls.push({ url: page.url, siteId: site.id });
      }
    }
  }
}

// Load both local JSON files
addPages(resolve(ROOT, 'public/sites-data1.json'));
addPages(resolve(ROOT, 'public/sites-data.json'));

// Also fetch Noah's web mapper data
try {
  console.log('Fetching Noah\'s web mapper data...');
  const res = await fetch('https://raw.githubusercontent.com/noah-n-pham/uf-web-mapper/main/public/data.json', {
    signal: AbortSignal.timeout(15000),
  });
  if (res.ok) {
    const noahData = await res.json();
    const sites = noahData.subsites || [];
    let added = 0;
    for (const site of sites) {
      for (const page of site.pages || []) {
        if (page.url && !seenUrls.has(page.url)) {
          seenUrls.add(page.url);
          allUrls.push({ url: page.url, siteId: site.id });
          added++;
        }
      }
    }
    console.log(`Added ${added} additional URLs from Noah's web mapper`);
  }
} catch {
  console.log('Could not fetch Noah\'s data, skipping');
}
console.log(`\nTotal pages to check: ${allUrls.length}`);
if (DRY_RUN) console.log('DRY RUN — no files will be modified\n');

// ── HTTP check ─────────────────────────────────────────────
async function checkStatus(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    return res.status;
  } catch {
    // Some servers reject HEAD — try GET as fallback
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });
      return res.status;
    } catch {
      return null; // unreachable — don't mark as 404 due to transient errors
    }
  }
}

// ── Parallel checking with concurrency limit ───────────────
async function checkAllPages(pages) {
  const results = new Map();
  let completed = 0;

  async function worker(queue) {
    while (queue.length > 0) {
      const { url, siteId } = queue.shift();
      const status = await checkStatus(url);
      results.set(url, { status, siteId });
      completed++;
      if (status === 404) {
        console.log(`[${completed}/${pages.length}] 404 — ${url}`);
      } else if (completed % 50 === 0 || completed === pages.length) {
        console.log(`[${completed}/${pages.length}] checked...`);
      }
    }
  }

  const queue = [...pages];
  const workers = Array.from({ length: CONCURRENCY }, () => worker(queue));
  await Promise.all(workers);
  return results;
}

// ── Main ───────────────────────────────────────────────────
const statusMap = await checkAllPages(allUrls);

// Collect 404 URLs
const notFoundUrls = [];
for (const [url, { status, siteId }] of statusMap) {
  if (status === 404) notFoundUrls.push({ url, siteId });
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Found ${notFoundUrls.length} pages returning 404 out of ${allUrls.length} total`);
console.log(`${'='.repeat(60)}\n`);

if (notFoundUrls.length === 0) {
  console.log('No 404 pages found. Nothing to mark.');
  process.exit(0);
}

if (DRY_RUN) {
  console.log('404 pages that would be marked:');
  for (const { url } of notFoundUrls) console.log(`  - ${url}`);
  console.log(`\nRe-run without --dry-run to apply changes.`);
  process.exit(0);
}

// ── Write 404-pages.json ───────────────────────────────────
const output = {
  lastChecked: new Date().toISOString(),
  totalChecked: allUrls.length,
  urls: notFoundUrls.map(({ url }) => url),
};

writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.log(`Wrote ${notFoundUrls.length} 404 URLs to public/404-pages.json`);
console.log(`Dashboard will auto-detect these and show them as "404" status.`);
console.log(`\nDone!`);
