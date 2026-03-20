#!/usr/bin/env node
/**
 * Lighthouse Accessibility Audit Script (FAST — Node API + 3 parallel Chrome instances)
 * Runs Lighthouse for EVERY page — accessibility score ONLY.
 * Auto-retries failed pages up to 5 passes.
 * Output: public/lighthouse-scores.json
 *
 * Usage: node scripts/lighthouse-audit.mjs
 */

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CONCURRENCY = 1;
const MAX_PASSES = 5;

// Load all 3 data sources (matching dashboard behavior)
const sites1Path = resolve(ROOT, 'public/sites-data1.json');
const sites2Path = resolve(ROOT, 'public/sites-data.json');
const noahUrl = 'https://raw.githubusercontent.com/noah-n-pham/uf-web-mapper/main/public/data.json';

const sites1 = JSON.parse(readFileSync(sites1Path, 'utf-8')).subsites || [];
let sites2 = [];
if (existsSync(sites2Path)) {
  try { sites2 = JSON.parse(readFileSync(sites2Path, 'utf-8')).subsites || []; } catch {}
}

// Fetch Noah's data
let noahSites = [];
try {
  console.log('📥 Fetching Noah\'s web mapper data...');
  const res = await fetch(noahUrl, { signal: AbortSignal.timeout(15000) });
  if (res.ok) {
    const data = await res.json();
    noahSites = data.subsites || [];
    console.log(`   Found ${noahSites.length} sites from Noah's data`);
  }
} catch (err) {
  console.log(`   ⚠️ Could not fetch Noah's data: ${err.message}`);
}

// Merge all sites — use URL as dedup key
const sites = [...sites1];
const seenSiteIds = new Set(sites1.map(s => s.id));

// Add sites-data.json pages (new URLs only)
for (const site of sites2) {
  if (seenSiteIds.has(site.id)) {
    const existing = sites.find(s => s.id === site.id);
    const existingUrls = new Set((existing.pages || []).map(p => p.url));
    for (const page of (site.pages || [])) {
      if (page.url && !existingUrls.has(page.url)) {
        existing.pages = existing.pages || [];
        existing.pages.push(page);
      }
    }
  } else {
    sites.push(site);
    seenSiteIds.add(site.id);
  }
}

// Add Noah's data (new URLs only)
for (const site of noahSites) {
  if (seenSiteIds.has(site.id)) {
    const existing = sites.find(s => s.id === site.id);
    const existingUrls = new Set((existing.pages || []).map(p => p.url));
    for (const page of (site.pages || [])) {
      if (page.url && !existingUrls.has(page.url)) {
        existing.pages = existing.pages || [];
        existing.pages.push(page);
      }
    }
  } else {
    sites.push(site);
    seenSiteIds.add(site.id);
  }
}

console.log(`📊 Merged ${sites.length} sites from all 3 sources`);

// Load known 404 pages — skip them entirely
const fourOhFourPath = resolve(ROOT, 'public/404-pages.json');
let known404s = new Set();
if (existsSync(fourOhFourPath)) {
  try {
    const raw = JSON.parse(readFileSync(fourOhFourPath, 'utf-8'));
    known404s = new Set(raw.urls || []);
    console.log(`📋 Loaded ${known404s.size} known 404 pages from 404-pages.json — skipping them`);
  } catch {}
}

// Build flat list of all pages (excluding known 404s)
const allPages = [];
let skipped404 = 0;
for (const site of sites) {
  const pages = site.pages || [];
  if (pages.length === 0 && site.baseUrl) {
    if (known404s.has(site.baseUrl)) { skipped404++; } else {
      allPages.push({ siteId: site.id, url: site.baseUrl });
    }
  } else {
    for (const page of pages) {
      if (page.url && page.url.startsWith('http')) {
        if (known404s.has(page.url)) { skipped404++; } else {
          allPages.push({ siteId: site.id, url: page.url });
        }
      }
    }
  }
}

// Dedup by URL
const seenUrls = new Set();
const dedupedPages = [];
for (const p of allPages) {
  if (!seenUrls.has(p.url)) {
    seenUrls.add(p.url);
    dedupedPages.push(p);
  }
}
const allPagesDeduped = dedupedPages;
console.log(`📊 ${allPagesDeduped.length} unique pages to process (${skipped404} known 404s skipped, ${allPages.length - dedupedPages.length} duplicates removed)`);

// Lighthouse config — accessibility only, minimal work
const lhConfig = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['accessibility'],
    disableStorageReset: true,
    skipAudits: ['screenshot-thumbnails', 'final-screenshot', 'full-page-screenshot'],
  },
};

const lhFlags = {
  output: 'json',
  logLevel: 'error',
  maxWaitForLoad: 45000,
};

// Prevent Windows EPERM crash from chrome-launcher temp dir cleanup
process.on('uncaughtException', (err) => {
  if (err.code === 'EPERM' && err.path?.includes('lighthouse')) {
    return;
  }
  console.error('Uncaught:', err);
  process.exit(1);
});

const scoresPath = resolve(ROOT, 'public/lighthouse-scores.json');

function loadExisting() {
  let existing = { pages: {}, sites: {} };
  if (existsSync(scoresPath)) {
    try {
      const raw = JSON.parse(readFileSync(scoresPath, 'utf-8'));
      if (raw.pages) existing = raw;
    } catch {}
  }
  return existing;
}

function recalcSiteAverages(results) {
  const siteScores = {};
  for (const [, data] of Object.entries(results.pages)) {
    const sid = data.siteId;
    if (!sid) continue;
    if (!siteScores[sid]) siteScores[sid] = { total: 0, count: 0, scanned: 0 };
    siteScores[sid].scanned++;
    if (data.score !== null && !data.error) {
      siteScores[sid].total += data.score;
      siteScores[sid].count++;
    }
  }
  for (const [sid, s] of Object.entries(siteScores)) {
    results.sites[sid] = {
      avgScore: s.count > 0 ? Math.round(s.total / s.count) : null,
      pageCount: sites.find(x => x.id === sid)?.pages?.length || 0,
      scannedCount: s.scanned,
      lastRun: new Date().toISOString(),
    };
  }
}

async function checkHttp(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(10000) });
    return res.status;
  } catch {
    return null;
  }
}

async function scanPage(url, siteId, idx, total, results) {
  // Quick HTTP check first — skip 404s without launching Chrome
  const httpStatus = await checkHttp(url);
  if (httpStatus === 404) {
    results.pages[url] = { siteId, score: null, lastRun: new Date().toISOString(), status: 404 };
    console.log(`[${idx}/${total}] 🚫 404 — ${url}`);
    return true;
  }

  let chrome;
  try {
    chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
    });

    const result = await lighthouse(url, { ...lhFlags, port: chrome.port }, lhConfig);
    const score = Math.round((result.lhr.categories?.accessibility?.score || 0) * 100);

    results.pages[url] = { siteId, score, lastRun: new Date().toISOString() };
    console.log(`[${idx}/${total}] ✅ ${score} — ${url}`);
    return true;
  } catch (err) {
    results.pages[url] = { siteId, score: null, lastRun: new Date().toISOString(), error: true };
    console.log(`[${idx}/${total}] ❌ ${url} — ${(err.message || '').substring(0, 60)}`);
    return false;
  } finally {
    if (chrome) {
      try { await chrome.kill(); } catch {}
    }
  }
}

async function runPass(passNum) {
  const existing = loadExisting();
  const results = { pages: { ...existing.pages }, sites: { ...existing.sites } };

  // Filter out already-scanned pages (within last 24 hours)
  const toScan = allPagesDeduped.filter(p => {
    const prev = results.pages[p.url];
    // Skip 404 pages — no point retrying
    if (prev && prev.status === 404) return false;
    if (prev && prev.score !== null && !prev.error) {
      const age = Date.now() - new Date(prev.lastRun).getTime();
      if (age < 24 * 60 * 60 * 1000) return false;
    }
    return true;
  });

  const skipped = allPagesDeduped.length - toScan.length;

  if (toScan.length === 0) {
    console.log(`\n🎉 Pass ${passNum}: All ${allPagesDeduped.length} pages already scored! Nothing to do.`);
    return 0;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 Pass ${passNum}/${MAX_PASSES}: ${toScan.length} pages to scan (${skipped} already done, ${allPagesDeduped.length} total)`);
  console.log(`⚡ Running ${CONCURRENCY} parallel Chrome instances`);
  console.log(`${'='.repeat(60)}\n`);

  let completed = 0;
  let failedCount = 0;
  const passStart = Date.now();
  let batchNum = 0;

  for (let i = 0; i < toScan.length; i += CONCURRENCY) {
    const batch = toScan.slice(i, i + CONCURRENCY);
    batchNum++;

    const batchResults = await Promise.all(
      batch.map((p, j) => scanPage(p.url, p.siteId, i + j + 1, toScan.length, results))
    );

    completed += batchResults.filter(r => r).length;
    failedCount += batchResults.filter(r => !r).length;

    // Small delay between batches to let Chrome fully clean up
    await new Promise(r => setTimeout(r, 2000));

    recalcSiteAverages(results);
    writeFileSync(scoresPath, JSON.stringify(results, null, 2));

    const done = completed + failedCount;
    if (done > 0 && batchNum % 3 === 0) {
      const elapsed = (Date.now() - passStart) / 1000;
      const perPage = elapsed / done;
      const remaining = Math.round((toScan.length - i - batch.length) * perPage / 60);
      console.log(`  ⏱️  ${done}/${toScan.length} done, ~${remaining} min remaining (${perPage.toFixed(1)}s/page)\n`);
    }
  }

  recalcSiteAverages(results);
  writeFileSync(scoresPath, JSON.stringify(results, null, 2));

  const passTime = Math.round((Date.now() - passStart) / 60000);
  console.log(`\n✅ Pass ${passNum} done in ${passTime} min — ${completed} succeeded, ${failedCount} failed, ${skipped} skipped`);

  return failedCount;
}

// Main: run up to MAX_PASSES, auto-retrying failed pages
const globalStart = Date.now();
let totalFailed = 0;

for (let pass = 1; pass <= MAX_PASSES; pass++) {
  const failedThisPass = await runPass(pass);

  if (failedThisPass === 0) {
    console.log(`\n🎉 All pages scored successfully!`);
    break;
  }

  if (pass < MAX_PASSES) {
    console.log(`\n⏳ ${failedThisPass} pages failed — starting retry pass ${pass + 1} in 10 seconds...`);
    await new Promise(r => setTimeout(r, 10000));
  } else {
    totalFailed = failedThisPass;
    console.log(`\n⚠️  ${failedThisPass} pages still failed after ${MAX_PASSES} passes.`);
  }
}

const totalTime = Math.round((Date.now() - globalStart) / 60000);
console.log(`\n📊 Total time: ${totalTime} min`);
console.log(`📄 Results saved to public/lighthouse-scores.json`);
