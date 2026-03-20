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
const CONCURRENCY = 3;
const MAX_PASSES = 5;

// Load sites
const sitesPath = resolve(ROOT, 'public/sites-data1.json');
const sitesData = JSON.parse(readFileSync(sitesPath, 'utf-8'));
const sites = sitesData.subsites || [];

// Build flat list of all pages
const allPages = [];
for (const site of sites) {
  const pages = site.pages || [];
  if (pages.length === 0 && site.baseUrl) {
    allPages.push({ siteId: site.id, url: site.baseUrl });
  } else {
    for (const page of pages) {
      if (page.url && page.url.startsWith('http')) {
        allPages.push({ siteId: site.id, url: page.url });
      }
    }
  }
}

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
  const toScan = allPages.filter(p => {
    const prev = results.pages[p.url];
    // Skip 404 pages — no point retrying
    if (prev && prev.status === 404) return false;
    if (prev && prev.score !== null && !prev.error) {
      const age = Date.now() - new Date(prev.lastRun).getTime();
      if (age < 24 * 60 * 60 * 1000) return false;
    }
    return true;
  });

  const skipped = allPages.length - toScan.length;

  if (toScan.length === 0) {
    console.log(`\n🎉 Pass ${passNum}: All ${allPages.length} pages already scored! Nothing to do.`);
    return 0;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 Pass ${passNum}/${MAX_PASSES}: ${toScan.length} pages to scan (${skipped} already done, ${allPages.length} total)`);
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
