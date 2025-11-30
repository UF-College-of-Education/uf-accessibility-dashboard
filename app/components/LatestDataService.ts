// app/components/LatestDataService.ts
// UPDATED: Removed all fake score calculations
// Only shows real issue counts, no fake Lighthouse scores

// ============ TYPES ============

export interface ScanIssueNode {
  html: string;
  target: string | string[];
  failureSummary: string;
}

export interface ScanIssue {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  nodes: ScanIssueNode[];
}

export interface PageScanResult {
  url: string;
  title: string;
  site: string;
  scannedAt?: string;
  scannedBy?: string;
  issues: ScanIssue[];
  summary: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

export interface PageIndexEntry {
  url: string;
  title: string;
  filePath: string;
  scannedAt: string;
  scannedBy: string;
  summary: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

export interface ScanIndex {
  lastUpdated: string;
  totalPages: number;
  totalIssues: number;
  summary: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  pages: PageIndexEntry[];
}

export interface ScanMetadata {
  scanDate: string;
  scannedBy: string;
  totalPages: number;
  totalIssues?: number;
  note?: string;
  summary?: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

// ============ LEGACY TYPES (for LatestDataModal compatibility) ============

export interface LighthouseScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

export interface IssueDetail {
  id: string;
  impact: string;
  description: string;
  help?: string;
  message?: string;
  helpUrl?: string;
  nodes?: ScanIssueNode[];
}

export interface PageScanData {
  url: string;
  title: string;
  lastScanned: string;
  lighthouse: LighthouseScores;
  issues: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  issueDetails?: IssueDetail[];
}

// ============ CACHE ============

let indexCache: ScanIndex | null = null;
let indexCacheTime = 0;
const CACHE_TTL = 30000; // 30 seconds

// ============ CORE FUNCTIONS ============

/**
 * Check if scan data exists
 */
export async function hasScanData(): Promise<boolean> {
  try {
    let response = await fetch('/scan-data/index.json', { 
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (response.ok) return true;
    
    response = await fetch('/scan-data/latest-scan.json', { cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the last scan date
 */
export async function getLastScanDate(): Promise<string | null> {
  try {
    const index = await loadIndex();
    return index?.lastUpdated || null;
  } catch {
    return null;
  }
}

/**
 * Load the lightweight index
 */
export async function loadIndex(): Promise<ScanIndex | null> {
  if (indexCache && Date.now() - indexCacheTime < CACHE_TTL) {
    return indexCache;
  }
  
  try {
    const response = await fetch('/scan-data/index.json', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    if (response.ok) {
      const index: ScanIndex = await response.json();
      indexCache = index;
      indexCacheTime = Date.now();
      return index;
    }
    
    return await loadLegacyAsIndex();
  } catch (error) {
    console.error('Error loading index:', error);
    return await loadLegacyAsIndex();
  }
}

/**
 * Load legacy latest-scan.json and convert to index format
 */
async function loadLegacyAsIndex(): Promise<ScanIndex | null> {
  try {
    const response = await fetch('/scan-data/latest-scan.json', { cache: 'no-store' });
    if (!response.ok) return null;
    
    const data = await response.json();
    
    const pages: PageIndexEntry[] = (data.results || []).map((r: any) => ({
      url: r.url,
      title: r.title,
      filePath: '',
      scannedAt: r.scannedAt || data.metadata?.scanDate,
      scannedBy: data.metadata?.scannedBy || 'Unknown',
      summary: r.summary,
    }));
    
    let critical = 0, serious = 0, moderate = 0, minor = 0;
    for (const p of pages) {
      critical += p.summary?.critical || 0;
      serious += p.summary?.serious || 0;
      moderate += p.summary?.moderate || 0;
      minor += p.summary?.minor || 0;
    }
    
    const index: ScanIndex = {
      lastUpdated: data.metadata?.scanDate || new Date().toISOString(),
      totalPages: pages.length,
      totalIssues: critical + serious + moderate + minor,
      summary: { critical, serious, moderate, minor },
      pages,
    };
    
    indexCache = index;
    indexCacheTime = Date.now();
    return index;
  } catch {
    return null;
  }
}

/**
 * Load a single page's full data
 */
export async function loadPageData(filePath: string): Promise<PageScanResult | null> {
  if (!filePath) return null;
  
  try {
    const response = await fetch(`/scan-data/${filePath}`, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Error loading page ${filePath}:`, error);
    return null;
  }
}

/**
 * Load multiple pages in parallel
 */
export async function loadMultiplePages(filePaths: string[]): Promise<PageScanResult[]> {
  const validPaths = filePaths.filter(fp => fp && fp.length > 0);
  const promises = validPaths.map(fp => loadPageData(fp));
  const results = await Promise.all(promises);
  return results.filter((r): r is PageScanResult => r !== null);
}

/**
 * Load page details by URL
 */
export async function loadPageDetails(url: string): Promise<PageScanResult | null> {
  const index = await loadIndex();
  if (!index) return null;
  
  const pageEntry = index.pages.find(p => p.url === url);
  if (!pageEntry) return null;
  
  if (pageEntry.filePath) {
    return await loadPageData(pageEntry.filePath);
  }
  
  try {
    const response = await fetch('/scan-data/latest-scan.json', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      return (data.results || []).find((r: any) => r.url === url) || null;
    }
  } catch {}
  
  return null;
}

/**
 * Check which URLs have scan data
 */
export function checkDataAvailability(
  results: PageScanResult[], 
  urls: string[]
): { available: string[]; missing: string[] } {
  const scannedUrls = new Set(results.map(r => r.url));
  const available: string[] = [];
  const missing: string[] = [];
  
  for (const url of urls) {
    if (scannedUrls.has(url)) {
      available.push(url);
    } else {
      missing.push(url);
    }
  }
  
  return { available, missing };
}

/**
 * Filter results by URLs
 */
export function filterResultsByUrls(results: PageScanResult[], urls: string[]): PageScanResult[] {
  const urlSet = new Set(urls);
  return results.filter(r => urlSet.has(r.url));
}

/**
 * Clear cache
 */
export function clearCache(): void {
  indexCache = null;
  indexCacheTime = 0;
}

/**
 * MAIN FUNCTION: Load pre-scanned data for PreScannedDataModal
 */
export async function loadPreScannedData(): Promise<{
  metadata: ScanMetadata;
  results: PageScanResult[];
} | null> {
  const index = await loadIndex();
  if (!index || index.pages.length === 0) return null;
  
  const metadata: ScanMetadata = {
    scanDate: index.lastUpdated,
    scannedBy: index.pages[0]?.scannedBy || 'Unknown',
    totalPages: index.totalPages,
    totalIssues: index.totalIssues,
    note: `${index.totalPages} pages scanned`,
    summary: index.summary,
  };
  
  const pagesWithFiles = index.pages.filter(p => p.filePath && p.filePath.length > 0);
  const pagesWithoutFiles = index.pages.filter(p => !p.filePath || p.filePath.length === 0);
  
  const results: PageScanResult[] = [];
  
  if (pagesWithFiles.length > 0) {
    const loaded = await loadMultiplePages(pagesWithFiles.map(p => p.filePath));
    results.push(...loaded);
  }
  
  if (pagesWithoutFiles.length > 0) {
    try {
      const response = await fetch('/scan-data/latest-scan.json', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        const legacyUrls = new Set(pagesWithoutFiles.map(p => p.url));
        const legacyResults = (data.results || []).filter((r: any) => legacyUrls.has(r.url));
        results.push(...legacyResults);
      }
    } catch {}
  }
  
  return { metadata, results };
}

// ============ LEGACY FUNCTIONS (for LatestDataModal compatibility) ============
// UPDATED: No fake scores - only real issue counts

/**
 * Fetch page scan data by URL (for LatestDataModal)
 * UPDATED: Returns 0 for all Lighthouse scores (no fake calculation)
 */
export async function fetchPageScanDataByUrl(url: string, siteBaseUrl?: string): Promise<PageScanData | null> {
  try {
    const pageResult = await loadPageDetails(url);
    
    if (pageResult) {
      const totalIssues = (pageResult.summary?.critical || 0) + 
                          (pageResult.summary?.serious || 0) + 
                          (pageResult.summary?.moderate || 0) + 
                          (pageResult.summary?.minor || 0);
      
      return {
        url: pageResult.url,
        title: pageResult.title,
        lastScanned: pageResult.scannedAt || new Date().toISOString(),
        // NO FAKE SCORES - all zeros
        // Use "Lighthouse Score" button for real accessibility scores
        lighthouse: {
          performance: 0,
          accessibility: 0, // NO FAKE SCORE - use Lighthouse button for real score
          bestPractices: 0,
          seo: 0,
        },
        issues: {
          total: totalIssues,
          critical: pageResult.summary?.critical || 0,
          serious: pageResult.summary?.serious || 0,
          moderate: pageResult.summary?.moderate || 0,
          minor: pageResult.summary?.minor || 0,
        },
        issueDetails: (pageResult.issues || []).map(issue => ({
          id: issue.id,
          impact: issue.impact,
          description: issue.description,
          help: issue.help,
          helpUrl: issue.helpUrl,
          nodes: issue.nodes,
        })),
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching page data for ${url}:`, error);
    return null;
  }
}

/**
 * Get all available scan data (for LatestDataModal)
 * UPDATED: Returns 0 for all Lighthouse scores (no fake calculation)
 */
export async function getAllScanData(): Promise<PageScanData[]> {
  const data = await loadPreScannedData();
  if (!data) return [];
  
  return data.results.map(r => {
    const totalIssues = (r.summary?.critical || 0) + 
                        (r.summary?.serious || 0) + 
                        (r.summary?.moderate || 0) + 
                        (r.summary?.minor || 0);
    
    return {
      url: r.url,
      title: r.title,
      lastScanned: r.scannedAt || new Date().toISOString(),
      // NO FAKE SCORES - all zeros
      lighthouse: {
        performance: 0,
        accessibility: 0, // NO FAKE SCORE
        bestPractices: 0,
        seo: 0,
      },
      issues: {
        total: totalIssues,
        critical: r.summary?.critical || 0,
        serious: r.summary?.serious || 0,
        moderate: r.summary?.moderate || 0,
        minor: r.summary?.minor || 0,
      },
      issueDetails: (r.issues || []).map(issue => ({
        id: issue.id,
        impact: issue.impact,
        description: issue.description,
        help: issue.help,
        helpUrl: issue.helpUrl,
        nodes: issue.nodes,
      })),
    };
  });
}