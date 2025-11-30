// app/api/save-scan-to-github/route.ts
// API to automatically save scan results to GitHub repository

import { NextRequest, NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'ufaboratories'; // UF organization
const REPO_NAME = 'uf-accessibility-dashboard'; // Repository name
const BRANCH = 'main';

interface ScanResult {
  url: string;
  title: string;
  site?: string;
  issues: Array<{
    id: string;
    impact: string;
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

interface SaveRequest {
  results: ScanResult[];
  scannedBy: string;
  note?: string;
}

// Convert URL to safe filename
function urlToFilename(url: string): string {
  try {
    const urlObj = new URL(url);
    let path = urlObj.pathname;
    
    // Remove leading/trailing slashes
    path = path.replace(/^\/|\/$/g, '');
    
    // If empty (homepage), use 'index'
    if (!path) {
      path = 'index';
    }
    
    // Replace remaining slashes with double underscores
    path = path.replace(/\//g, '__');
    
    // Remove any unsafe characters
    path = path.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    return `${path}.json`;
  } catch {
    return 'unknown.json';
  }
}

// Get hostname folder from URL
function getHostFolder(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/\./g, '_');
  } catch {
    return 'unknown_host';
  }
}

// Get file from GitHub
async function getGitHubFile(path: string): Promise<{ content: string; sha: string } | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return { content, sha: data.sha };
    }
    return null;
  } catch {
    return null;
  }
}

// Create or update file on GitHub
async function saveToGitHub(path: string, content: string, message: string, sha?: string): Promise<boolean> {
  try {
    const body: any = {
      message,
      content: Buffer.from(content).toString('base64'),
      branch: BRANCH,
    };

    if (sha) {
      body.sha = sha;
    }

    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('GitHub API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving to GitHub:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check for GitHub token
    if (!GITHUB_TOKEN) {
      return NextResponse.json(
        { error: 'GitHub token not configured. Add GITHUB_TOKEN to environment variables.' },
        { status: 500 }
      );
    }

    const body: SaveRequest = await request.json();
    const { results, scannedBy, note } = body;

    if (!results || results.length === 0) {
      return NextResponse.json(
        { error: 'No scan results provided' },
        { status: 400 }
      );
    }

    const scanDate = new Date().toISOString();
    const savedFiles: string[] = [];
    const errors: string[] = [];

    // 1. Save individual page results
    for (const result of results) {
      const hostFolder = getHostFolder(result.url);
      const filename = urlToFilename(result.url);
      const filePath = `public/scan-data/pages/${hostFolder}/${filename}`;

      const pageData = {
        url: result.url,
        title: result.title,
        site: result.site || 'UF College of Education',
        scannedAt: scanDate,
        scannedBy,
        issues: result.issues,
        summary: result.summary,
      };

      // Check if file exists (to get SHA for update)
      const existing = await getGitHubFile(filePath);
      
      const success = await saveToGitHub(
        filePath,
        JSON.stringify(pageData, null, 2),
        `🔍 Scan update: ${result.title} - ${new Date().toLocaleDateString()}`,
        existing?.sha
      );

      if (success) {
        savedFiles.push(filePath);
      } else {
        errors.push(`Failed to save: ${result.url}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 2. Update metadata.json with scan info
    const metadataPath = 'public/scan-data/metadata.json';
    const existingMetadata = await getGitHubFile(metadataPath);
    
    let allScannedPages: string[] = [];
    if (existingMetadata) {
      try {
        const parsed = JSON.parse(existingMetadata.content);
        allScannedPages = parsed.scannedPages || [];
      } catch {}
    }

    // Add new URLs to the list (no duplicates)
    const newUrls = results.map(r => r.url);
    allScannedPages = [...new Set([...allScannedPages, ...newUrls])];

    const metadata = {
      lastScanDate: scanDate,
      lastScannedBy: scannedBy,
      lastScanNote: note || `Scanned ${results.length} pages`,
      totalPagesScanned: allScannedPages.length,
      scannedPages: allScannedPages,
      scanHistory: [
        {
          date: scanDate,
          scannedBy,
          pagesScanned: results.length,
          note: note || `Scanned ${results.length} pages`,
        },
        // Keep last 10 scan records
      ],
    };

    // Load existing history
    if (existingMetadata) {
      try {
        const parsed = JSON.parse(existingMetadata.content);
        if (parsed.scanHistory) {
          metadata.scanHistory = [
            metadata.scanHistory[0],
            ...parsed.scanHistory.slice(0, 9),
          ];
        }
      } catch {}
    }

    await saveToGitHub(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      `📊 Metadata update: ${results.length} pages scanned`,
      existingMetadata?.sha
    );

    // 3. Create/update latest-scan.json (combined file for backward compatibility)
    const latestScanPath = 'public/scan-data/latest-scan.json';
    const existingLatest = await getGitHubFile(latestScanPath);

    let allResults: any[] = [];
    if (existingLatest) {
      try {
        const parsed = JSON.parse(existingLatest.content);
        allResults = parsed.results || [];
      } catch {}
    }

    // Update or add results (replace if URL exists, add if new)
    for (const result of results) {
      const index = allResults.findIndex(r => 
        r.url.toLowerCase().replace(/\/$/, '') === result.url.toLowerCase().replace(/\/$/, '')
      );
      
      const pageResult = {
        url: result.url,
        title: result.title,
        site: result.site || 'UF College of Education',
        scannedAt: scanDate,
        issues: result.issues,
        summary: result.summary,
      };

      if (index >= 0) {
        allResults[index] = pageResult;
      } else {
        allResults.push(pageResult);
      }
    }

    const latestScanData = {
      metadata: {
        scanDate,
        scannedBy,
        totalPages: allResults.length,
        note: note || `Latest scan data - ${allResults.length} pages`,
      },
      results: allResults,
    };

    await saveToGitHub(
      latestScanPath,
      JSON.stringify(latestScanData, null, 2),
      `🔄 Latest scan update: ${results.length} pages`,
      existingLatest?.sha
    );

    return NextResponse.json({
      success: true,
      message: `Saved ${savedFiles.length} pages to GitHub`,
      savedFiles,
      errors: errors.length > 0 ? errors : undefined,
      scanDate,
    });

  } catch (error) {
    console.error('Error in save-scan-to-github:', error);
    return NextResponse.json(
      { error: `Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
