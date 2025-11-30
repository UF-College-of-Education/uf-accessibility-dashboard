// SaveScanDataUtil.ts
// Utility to save Real Scan results to a JSON file for pre-scanned data

export interface ScanResultForSave {
  url: string;
  title: string;
  site: string;
  issues: Array<{
    id: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    description: string;
    help: string;
    helpUrl: string;
    nodes: Array<{
      html: string;
      target: string | string[];
      failureSummary: string;
    }>;
  }>;
  summary: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

export interface SaveScanDataPayload {
  metadata: {
    scanDate: string;
    scannedBy: string;
    totalPages: number;
    note?: string;
  };
  results: ScanResultForSave[];
}

// Convert Real Scan results to saveable format
export function formatResultsForSave(
  results: any[], // Results from Real Scan
  scannedBy: string,
  note?: string
): SaveScanDataPayload {
  const formattedResults: ScanResultForSave[] = results.map(result => ({
    url: result.url || result.pageUrl || '',
    title: result.title || result.pageTitle || 'Unknown Page',
    site: result.site || 'UF College of Education',
    issues: (result.issues || []).map((issue: any) => ({
      id: issue.id || 'unknown',
      impact: issue.impact || 'moderate',
      description: issue.description || '',
      help: issue.help || '',
      helpUrl: issue.helpUrl || '',
      nodes: (issue.nodes || []).map((node: any) => ({
        html: node.html || '',
        target: node.target || '',
        failureSummary: node.failureSummary || ''
      }))
    })),
    summary: result.summary || {
      critical: (result.issues || []).filter((i: any) => i.impact === 'critical').length,
      serious: (result.issues || []).filter((i: any) => i.impact === 'serious').length,
      moderate: (result.issues || []).filter((i: any) => i.impact === 'moderate').length,
      minor: (result.issues || []).filter((i: any) => i.impact === 'minor').length
    }
  }));

  return {
    metadata: {
      scanDate: new Date().toISOString(),
      scannedBy: scannedBy,
      totalPages: formattedResults.length,
      note: note
    },
    results: formattedResults
  };
}

// Download scan data as JSON file
export function downloadScanDataAsJson(
  results: any[],
  scannedBy: string,
  note?: string,
  filename?: string
): void {
  const payload = formatResultsForSave(results, scannedBy, note);
  
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `latest-scan.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Merge new scan results with existing data
// This is useful if you want to add new pages to existing pre-scanned data
export function mergeWithExistingData(
  existingData: SaveScanDataPayload,
  newResults: any[],
  scannedBy: string,
  note?: string
): SaveScanDataPayload {
  const newPayload = formatResultsForSave(newResults, scannedBy, note);
  
  // Create a map of existing results by URL
  const existingMap = new Map<string, ScanResultForSave>();
  existingData.results.forEach(result => {
    existingMap.set(result.url.toLowerCase().replace(/\/$/, ''), result);
  });
  
  // Update or add new results
  newPayload.results.forEach(result => {
    const normalizedUrl = result.url.toLowerCase().replace(/\/$/, '');
    existingMap.set(normalizedUrl, result);
  });
  
  return {
    metadata: {
      scanDate: new Date().toISOString(),
      scannedBy: scannedBy,
      totalPages: existingMap.size,
      note: note || existingData.metadata.note
    },
    results: Array.from(existingMap.values())
  };
}

// Validate scan data structure
export function validateScanData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data) {
    errors.push('Data is empty');
    return { valid: false, errors };
  }
  
  if (!data.metadata) {
    errors.push('Missing metadata');
  } else {
    if (!data.metadata.scanDate) errors.push('Missing scanDate in metadata');
    if (!data.metadata.scannedBy) errors.push('Missing scannedBy in metadata');
  }
  
  if (!data.results || !Array.isArray(data.results)) {
    errors.push('Missing or invalid results array');
  } else if (data.results.length === 0) {
    errors.push('Results array is empty');
  } else {
    // Check first result structure
    const first = data.results[0];
    if (!first.url) errors.push('Results missing url field');
    if (!first.issues) errors.push('Results missing issues field');
  }
  
  return { valid: errors.length === 0, errors };
}
