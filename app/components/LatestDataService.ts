// app/components/LatestDataService.ts
// Service to fetch pre-scanned accessibility data from JSON files

// ============================================
// INTERFACES
// ============================================

export interface LighthouseScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

export interface IssueNode {
  html: string;
  target: string;
  failureSummary?: string;
}

export interface IssueDetail {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  message?: string;
  description?: string;
  help?: string;
  helpUrl?: string;
  nodes?: IssueNode[];
  pageUrl?: string;
  pageTitle?: string;
}

export interface PageScanData {
  url: string;
  title: string;
  siteName: string;
  siteId?: string;
  lastScanned: string;
  scanSource: 'auto' | 'manual';
  lighthouse: LighthouseScores;
  issues: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  issueDetails: IssueDetail[];
}

export interface SiteSummary {
  id: string;
  name: string;
  baseUrl?: string;
  folderName: string;
  totalPages: number;
  scannedPages: number;
  lastScanned: string;
}

export interface ScanIndex {
  lastUpdated: string;
  totalSites: number;
  totalPages: number;
  totalScannedPages: number;
  sites: SiteSummary[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert URL to safe filename
 */
export function urlToFileName(url: string): string {
  try {
    const urlObj = new URL(url);
    let path = urlObj.pathname.replace(/^\/+|\/+$/g, '');
    path = path.replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '');
    if (!path) path = 'index';
    return path;
  } catch {
    return 'unknown';
  }
}

/**
 * Convert site URL to folder name
 */
export function siteToFolderName(baseUrl: string): string {
  try {
    const urlObj = new URL(baseUrl);
    let hostname = urlObj.hostname.replace(/\./g, '-');
    let path = urlObj.pathname.replace(/^\/+|\/+$/g, '');
    if (path) {
      path = path.replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '');
      hostname = `${hostname}-${path}`;
    }
    return hostname;
  } catch {
    return 'unknown-site';
  }
}

// ============================================
// DATA FETCHING
// ============================================

/**
 * Get base path for scan data
 */
function getScanDataBasePath(): string {
  return '/scan-data';
}

/**
 * Fetch the scan index
 */
export async function fetchScanIndex(): Promise<ScanIndex | null> {
  try {
    const basePath = getScanDataBasePath();
    const response = await fetch(`${basePath}/index.json`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      console.warn('Scan index not found');
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching scan index:', error);
    return null;
  }
}

/**
 * Fetch scan data for a specific page
 */
export async function fetchPageScanData(
  siteFolder: string,
  pageFileName: string
): Promise<PageScanData | null> {
  try {
    const basePath = getScanDataBasePath();
    const response = await fetch(`${basePath}/${siteFolder}/${pageFileName}.json`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching page scan data:', error);
    return null;
  }
}

/**
 * Fetch scan data by URL
 */
export async function fetchPageScanDataByUrl(
  pageUrl: string,
  siteBaseUrl: string
): Promise<PageScanData | null> {
  const siteFolder = siteToFolderName(siteBaseUrl);
  const pageFileName = urlToFileName(pageUrl);
  return fetchPageScanData(siteFolder, pageFileName);
}

/**
 * Fetch multiple page scans
 */
export async function fetchMultiplePageScans(
  pages: { url: string; siteBaseUrl: string }[]
): Promise<Map<string, PageScanData>> {
  const results = new Map<string, PageScanData>();
  
  const batchSize = 10;
  for (let i = 0; i < pages.length; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(async (page) => {
        const data = await fetchPageScanDataByUrl(page.url, page.siteBaseUrl);
        return { url: page.url, data };
      })
    );
    
    batchResults.forEach(({ url, data }) => {
      if (data) {
        results.set(url, data);
      }
    });
  }
  
  return results;
}

// ============================================
// CHECK DATA AVAILABILITY
// ============================================

/**
 * Check if any scan data exists
 */
export async function hasScanData(): Promise<boolean> {
  const index = await fetchScanIndex();
  return index !== null && index.totalScannedPages > 0;
}

/**
 * Get last scan date
 */
export async function getLastScanDate(): Promise<string | null> {
  const index = await fetchScanIndex();
  return index?.lastUpdated || null;
}

// ============================================
// FORMAT FOR UI
// ============================================

/**
 * Format scan data for results modal (same format as Real Scan)
 */
export function formatForResultsModal(scanData: PageScanData[]) {
  const pages = scanData.map(page => ({
    url: page.url,
    title: page.title,
    lighthouse: page.lighthouse,
    issues: page.issueDetails,
    issueCount: page.issues,
  }));

  const totalIssues = scanData.reduce((sum, p) => sum + p.issues.total, 0);
  const criticalCount = scanData.reduce((sum, p) => sum + p.issues.critical, 0);
  const seriousCount = scanData.reduce((sum, p) => sum + p.issues.serious, 0);
  const moderateCount = scanData.reduce((sum, p) => sum + p.issues.moderate, 0);
  const minorCount = scanData.reduce((sum, p) => sum + p.issues.minor, 0);

  const avgLighthouse: LighthouseScores = {
    performance: Math.round(scanData.reduce((sum, p) => sum + p.lighthouse.performance, 0) / scanData.length) || 0,
    accessibility: Math.round(scanData.reduce((sum, p) => sum + p.lighthouse.accessibility, 0) / scanData.length) || 0,
    bestPractices: Math.round(scanData.reduce((sum, p) => sum + p.lighthouse.bestPractices, 0) / scanData.length) || 0,
    seo: Math.round(scanData.reduce((sum, p) => sum + p.lighthouse.seo, 0) / scanData.length) || 0,
  };

  const latestScan = scanData.reduce((latest, p) => {
    const date = new Date(p.lastScanned);
    return date > new Date(latest) ? p.lastScanned : latest;
  }, scanData[0]?.lastScanned || new Date().toISOString());

  return {
    pages,
    summary: {
      totalPages: scanData.length,
      totalIssues,
      criticalCount,
      seriousCount,
      moderateCount,
      minorCount,
      averageLighthouse: avgLighthouse,
    },
    scanDate: latestScan,
    scanSource: scanData[0]?.scanSource || 'auto',
  };
}
