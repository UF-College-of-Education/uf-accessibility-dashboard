// app/api/save-scan-to-github/route.ts
// OPTION A: Index-based architecture for 1000+ pages
// - Saves each page as individual file
// - Maintains lightweight index.json for quick lookups
// - Accumulates all scans (merges new with existing)

import { NextRequest, NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'UF-College-of-Education';
const REPO_NAME = 'uf-accessibility-dashboard';
const BRANCH = 'main';

interface ScanResult {
  url: string;
  title: string;
  site: string;
  scannedAt?: string;
  issues: any[];
  summary: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

interface PageIndexEntry {
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

interface ScanIndex {
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

// Helper to make GitHub API calls
async function githubAPI(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

// Get file SHA (needed for updates)
async function getFileSha(path: string): Promise<string | null> {
  try {
    const data = await githubAPI(`/contents/${path}?ref=${BRANCH}`);
    return data.sha;
  } catch {
    return null;
  }
}

// Get existing file content
async function getFileContent<T>(path: string): Promise<T | null> {
  try {
    const data = await githubAPI(`/contents/${path}?ref=${BRANCH}`);
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

// Create or update a file
async function saveFile(path: string, content: string, message: string) {
  const sha = await getFileSha(path);
  
  const body: any = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: BRANCH,
  };
  
  if (sha) {
    body.sha = sha;
  }
  
  return githubAPI(`/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// Convert URL to safe filename
function urlToFilename(url: string): { host: string; path: string; full: string } {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.replace(/\./g, '_');
    const pathPart = urlObj.pathname
      .replace(/^\/|\/$/g, '')
      .replace(/\//g, '__')
      .replace(/[^a-zA-Z0-9_-]/g, '_') || 'index';
    return {
      host,
      path: pathPart,
      full: `${host}/${pathPart}`
    };
  } catch {
    const safe = url.replace(/[^a-zA-Z0-9]/g, '_');
    return { host: 'unknown', path: safe, full: `unknown/${safe}` };
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    if (!GITHUB_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'GitHub token not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { results, scannedBy = 'Unknown', note = '' } = body;

    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No results provided' },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();
    const savedFiles: string[] = [];
    const newPageEntries: PageIndexEntry[] = [];

    // 1. Save each page as individual file
    console.log(`💾 Saving ${results.length} page files...`);
    
    for (const result of results) {
      const filename = urlToFilename(result.url);
      const filePath = `public/scan-data/pages/${filename.full}.json`;
      
      const fileContent = {
        url: result.url,
        title: result.title,
        site: result.site || 'UF College of Education',
        scannedAt: result.scannedAt || timestamp,
        scannedBy,
        issues: result.issues,
        summary: result.summary,
      };

      const pageTitle = result.title || filename.path;
      
      try {
        await saveFile(
          filePath,
          JSON.stringify(fileContent, null, 2),
          `🔍 Scan: ${pageTitle}`
        );
        
        savedFiles.push(filePath);
        
        // Create index entry
        newPageEntries.push({
          url: result.url,
          title: result.title,
          filePath: `pages/${filename.full}.json`,
          scannedAt: result.scannedAt || timestamp,
          scannedBy,
          summary: result.summary,
        });
      } catch (err) {
        console.error(`Failed to save ${filePath}:`, err);
      }
    }

    // 2. Update the lightweight index.json
    console.log(`📋 Updating index.json...`);
    
    const indexPath = 'public/scan-data/index.json';
    let existingIndex = await getFileContent<ScanIndex>(indexPath);
    
    // If no index exists, try to migrate from legacy latest-scan.json
    if (!existingIndex) {
      const legacyPath = 'public/scan-data/latest-scan.json';
      const legacyData = await getFileContent<any>(legacyPath);
      
      if (legacyData?.results) {
        // Convert legacy format to index
        const legacyPages: PageIndexEntry[] = legacyData.results.map((r: any) => ({
          url: r.url,
          title: r.title,
          filePath: '', // Legacy pages don't have file paths yet
          scannedAt: r.scannedAt || legacyData.metadata?.scanDate,
          scannedBy: legacyData.metadata?.scannedBy || 'Unknown',
          summary: r.summary,
        }));
        
        existingIndex = {
          lastUpdated: legacyData.metadata?.scanDate || timestamp,
          totalPages: legacyPages.length,
          totalIssues: 0,
          summary: { critical: 0, serious: 0, moderate: 0, minor: 0 },
          pages: legacyPages,
        };
        console.log(`📦 Migrated ${legacyPages.length} pages from legacy format`);
      }
    }
    
    // Create URL map for fast lookup/merge
    const pagesMap = new Map<string, PageIndexEntry>();
    
    // Add existing pages to map
    if (existingIndex?.pages) {
      for (const page of existingIndex.pages) {
        pagesMap.set(page.url, page);
      }
    }
    
    // Add/update with new pages (new pages override existing)
    for (const entry of newPageEntries) {
      pagesMap.set(entry.url, entry);
    }
    
    // Convert back to array and calculate totals
    const allPages = Array.from(pagesMap.values());
    
    let totalCritical = 0;
    let totalSerious = 0;
    let totalModerate = 0;
    let totalMinor = 0;
    
    for (const page of allPages) {
      totalCritical += page.summary?.critical || 0;
      totalSerious += page.summary?.serious || 0;
      totalModerate += page.summary?.moderate || 0;
      totalMinor += page.summary?.minor || 0;
    }
    
    const newIndex: ScanIndex = {
      lastUpdated: timestamp,
      totalPages: allPages.length,
      totalIssues: totalCritical + totalSerious + totalModerate + totalMinor,
      summary: {
        critical: totalCritical,
        serious: totalSerious,
        moderate: totalModerate,
        minor: totalMinor,
      },
      // Sort by most recently scanned first
      pages: allPages.sort((a, b) => 
        new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()
      ),
    };
    
    await saveFile(
      indexPath,
      JSON.stringify(newIndex, null, 2),
      `📊 Index: ${allPages.length} pages, ${newIndex.totalIssues} issues`
    );
    
    savedFiles.push(indexPath);

    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      message: `✅ Saved ${results.length} pages in ${(duration/1000).toFixed(1)}s. Total: ${allPages.length} pages in database.`,
      savedFiles,
      stats: {
        pagesInThisBatch: results.length,
        totalPagesInDatabase: allPages.length,
        totalIssues: newIndex.totalIssues,
        summary: newIndex.summary,
        durationMs: duration,
      }
    });

  } catch (error) {
    console.error('Error saving to GitHub:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'GitHub Save API - Option A (Optimized for 1000+ pages)',
    repo: `${REPO_OWNER}/${REPO_NAME}`,
    architecture: {
      'index.json': 'Lightweight index with URLs, titles, summaries (~100KB for 1000 pages)',
      'pages/{host}/{path}.json': 'Full issue details per page (~5KB each)',
    },
    features: [
      'Individual files per page (fast updates)',
      'Lightweight index for quick lookups',
      'Accumulates all scans (merges new with existing)',
      'Migrates legacy latest-scan.json automatically',
    ]
  });
}