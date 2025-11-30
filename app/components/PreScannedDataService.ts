// PreScannedDataService.ts
// Service to load and filter pre-scanned accessibility data

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
  scannedAt: string;
  issues: ScanIssue[];
  summary: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

export interface ScanMetadata {
  scanDate: string;
  scannedBy: string;
  totalPages: number;
  note?: string;
}

export interface PreScannedData {
  metadata: ScanMetadata;
  results: PageScanResult[];
}

// Load pre-scanned data from the public folder
export async function loadPreScannedData(): Promise<PreScannedData | null> {
  try {
    const response = await fetch('/scan-data/latest-scan.json');
    if (!response.ok) {
      console.error('Failed to load pre-scanned data:', response.status);
      return null;
    }
    const data: PreScannedData = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading pre-scanned data:', error);
    return null;
  }
}

// Filter results to only show selected pages
export function filterResultsByUrls(
  allResults: PageScanResult[],
  selectedUrls: string[]
): PageScanResult[] {
  // Normalize URLs for comparison (remove trailing slashes, lowercase)
  const normalizeUrl = (url: string) => {
    return url.toLowerCase().replace(/\/$/, '');
  };

  const normalizedSelectedUrls = selectedUrls.map(normalizeUrl);

  return allResults.filter(result => 
    normalizedSelectedUrls.includes(normalizeUrl(result.url))
  );
}

// Calculate totals for filtered results
export function calculateTotals(results: PageScanResult[]): {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  total: number;
} {
  const totals = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    total: 0
  };

  results.forEach(page => {
    totals.critical += page.summary.critical;
    totals.serious += page.summary.serious;
    totals.moderate += page.summary.moderate;
    totals.minor += page.summary.minor;
  });

  totals.total = totals.critical + totals.serious + totals.moderate + totals.minor;

  return totals;
}

// Format date for display
export function formatScanDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}

// Check if pre-scanned data exists for given URLs
export function checkDataAvailability(
  allResults: PageScanResult[],
  selectedUrls: string[]
): {
  available: string[];
  missing: string[];
} {
  const normalizeUrl = (url: string) => url.toLowerCase().replace(/\/$/, '');
  
  const availableUrls = allResults.map(r => normalizeUrl(r.url));
  
  const available: string[] = [];
  const missing: string[] = [];

  selectedUrls.forEach(url => {
    if (availableUrls.includes(normalizeUrl(url))) {
      available.push(url);
    } else {
      missing.push(url);
    }
  });

  return { available, missing };
}
