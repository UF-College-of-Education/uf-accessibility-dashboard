// app/components/SiteimproveService.ts

/**
 * Siteimprove Integration Service
 *
 * Fetches accessibility issues (A, AA, ARIA) from Siteimprove API
 * and matches them to dashboard pages by URL.
 * Pulls data for ALL sites in the account.
 * Data is stored in localStorage only (no Google Sheets).
 *
 * CACHING: Data is cached for 1 hour. Auto-sync only fetches fresh data
 * if the cache is stale. Users can force re-sync via the button.
 */

const STORAGE_KEY = 'uf-accessibility-siteimprove-data';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

// ============================================
// TYPES
// ============================================

export interface SiteimprovePageIssue {
  pageId: number;
  url: string;
  title: string;
  issues: number;
  occurrences: number;
  aIssues: number;
  aaIssues: number;
  ariaIssues: number;
  aOccurrences: number;
  aaOccurrences: number;
  ariaOccurrences: number;
}

export interface SiteimproveData {
  pages: Record<string, SiteimprovePageIssue>; // keyed by normalized URL
  lastFetched: string;
  totalPagesWithIssues: number;
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Fetch all pages with A/AA/ARIA issues for a specific site
 */
async function fetchSiteimprovePages(siteId: number): Promise<SiteimprovePageIssue[]> {
  const response = await fetch('/api/siteimprove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'fetchPages', siteId }),
  });

  const data = await response.json();

  if (!data.success) {
    console.error(`Siteimprove fetch failed for site ${siteId}:`, data.error);
    return [];
  }

  return data.pages;
}

/**
 * Check if cached data is still fresh (less than 1 hour old)
 */
export function isSiteimproveCacheFresh(): boolean {
  const data = getSiteimproveDataLocal();
  if (!data) return false;

  const age = Date.now() - new Date(data.lastFetched).getTime();
  return age < CACHE_DURATION_MS;
}

/**
 * Main function: Fetch Siteimprove data for ALL sites and merge into one URL map.
 * Data is cached in localStorage only — no Google Sheets.
 *
 * If force=false (default on page load), skips fetch if cache is fresh.
 * If force=true (manual button click), always fetches fresh data.
 */
export async function syncAllSiteimproveData(
  onProgress?: (message: string) => void,
  force: boolean = false
): Promise<SiteimproveData> {
  // Check cache first (unless forced)
  if (!force) {
    const cached = getSiteimproveDataLocal();
    if (cached && isSiteimproveCacheFresh()) {
      onProgress?.(`Using cached data (${cached.totalPagesWithIssues} pages, synced ${new Date(cached.lastFetched).toLocaleTimeString()})`);
      return cached;
    }
  }

  onProgress?.('Fetching Siteimprove sites...');

  // Fetch sites list
  const sitesRes = await fetch('/api/siteimprove?action=sites');
  const sitesData = await sitesRes.json();

  if (!sitesData.success) {
    throw new Error(sitesData.error || 'Failed to fetch Siteimprove sites');
  }

  const sites = sitesData.sites as { id: number; name: string }[];
  onProgress?.(`Found ${sites.length} sites. Fetching A/AA/ARIA issues...`);

  // Fetch pages for all sites in parallel
  const allPagesArrays = await Promise.all(
    sites.map((site) => fetchSiteimprovePages(site.id))
  );

  // Merge all pages into one URL-keyed map
  const pagesMap: Record<string, SiteimprovePageIssue> = {};
  let totalCount = 0;

  for (const pages of allPagesArrays) {
    for (const page of pages) {
      if (page.url) {
        const normalizedUrl = page.url.replace(/\/$/, '');
        // If same URL from multiple sites, merge (take highest counts)
        const existing = pagesMap[normalizedUrl];
        if (existing) {
          existing.aIssues = Math.max(existing.aIssues, page.aIssues);
          existing.aaIssues = Math.max(existing.aaIssues, page.aaIssues);
          existing.ariaIssues = Math.max(existing.ariaIssues, page.ariaIssues);
          existing.issues = existing.aIssues + existing.aaIssues + existing.ariaIssues;
        } else {
          pagesMap[normalizedUrl] = { ...page };
          totalCount++;
        }
      }
    }
  }

  const result: SiteimproveData = {
    pages: pagesMap,
    lastFetched: new Date().toISOString(),
    totalPagesWithIssues: totalCount,
  };

  // Save to localStorage only
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  }

  onProgress?.(`Synced ${totalCount} pages with issues from ${sites.length} sites`);
  return result;
}

// ============================================
// LOCAL STORAGE FUNCTIONS
// ============================================

/**
 * Get cached Siteimprove data from localStorage
 */
export function getSiteimproveDataLocal(): SiteimproveData | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}
