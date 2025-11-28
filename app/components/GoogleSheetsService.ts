// app/components/GoogleSheetsService.ts

/**
 * Google Sheets Integration Service
 * 
 * This service handles:
 * 1. Exporting ALL pages from dashboard to Google Sheets
 * 2. Syncing status changes from website to sheet
 * 3. Reading status from sheet back to website
 * 
 * SETUP REQUIRED:
 * Add to .env.local:
 * NEXT_PUBLIC_GOOGLE_SCRIPT_URL=your_web_app_url_here
 */

// ============================================
// CONFIGURATION
// ============================================

// Get the Google Script URL from environment
const GOOGLE_SCRIPT_URL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || '')
  : '';

// Sheet IDs (for direct reading via CSV export)
const STATUS_SHEET_ID = '1ntgfO0PeVULOCA-Q1eLfoEJwW-izHlPpP1FvWvVk2UM';

// ============================================
// STATUS OPTIONS
// ============================================

export type PageStatusType = 'not-started' | 'working' | 'issues' | 'completed';

// Map between dashboard values and sheet values
const STATUS_MAP_TO_SHEET: Record<PageStatusType, string> = {
  'not-started': 'Not Started',
  'working': 'Working on it',
  'issues': 'Facing Issues',
  'completed': 'Completed'
};

const STATUS_MAP_FROM_SHEET: Record<string, PageStatusType> = {
  'Not Started': 'not-started',
  'Working on it': 'working',
  'Facing Issues': 'issues',
  'Completed': 'completed'
};

export const STATUS_OPTIONS: { value: PageStatusType; label: string; color: string; bgColor: string }[] = [
  { value: 'not-started', label: 'Not Started', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  { value: 'working', label: 'Working on it', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  { value: 'issues', label: 'Facing Issues', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  { value: 'completed', label: 'Completed', color: 'text-green-600', bgColor: 'bg-green-100' },
];

// ============================================
// INTERFACES
// ============================================

export interface PageStatus {
  siteId: string;
  siteName: string;
  pageUrl: string;
  pageTitle: string;
  status: PageStatusType;
  assignedTo: string;
  updatedDate: string;
  notes: string;
}

export interface TeamMember {
  name: string;
  email: string;
  role: string;
}

export interface ScanResultData {
  id: string;
  date: string;
  pageUrl: string;
  pageTitle: string;
  siteName: string;
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  lighthousePerformance: number;
  lighthouseAccessibility: number;
  lighthouseBestPractices: number;
  lighthouseSeo: number;
  issues: string;
  source: 'manual' | 'auto';
}

export interface SiteData {
  id: string;
  title: string;
  baseUrl: string;
  pages: { title: string; url: string }[];
}

// ============================================
// LOCAL STORAGE KEYS
// ============================================

const STORAGE_KEYS = {
  PAGE_STATUSES: 'uf-accessibility-page-statuses',
  TEAM_MEMBERS: 'uf-accessibility-team-members',
  SCAN_RESULTS: 'uf-accessibility-scan-results',
  LAST_SYNC: 'uf-accessibility-last-sync',
};

// ============================================
// GOOGLE SHEETS API FUNCTIONS
// ============================================

/**
 * Check if Google Sheets sync is configured
 */
export function isGoogleSheetsConfigured(): boolean {
  return Boolean(GOOGLE_SCRIPT_URL);
}

/**
 * Export ALL pages to Google Sheets
 * This sends all your sites and pages to the sheet
 */
export async function exportAllPagesToSheet(sites: SiteData[]): Promise<{ success: boolean; pagesExported?: number; error?: string }> {
  if (!GOOGLE_SCRIPT_URL) {
    return { success: false, error: 'Google Script URL not configured. Add NEXT_PUBLIC_GOOGLE_SCRIPT_URL to .env.local' };
  }

  try {
    // Get current statuses from localStorage
    const localStatuses = getAllPageStatusesLocal();

    // Build pages array with all data
    const pages: any[] = [];
    
    sites.forEach(site => {
      site.pages.forEach(page => {
        const localStatus = localStatuses[page.url];
        pages.push({
          siteName: site.title,
          title: page.title,
          url: page.url,
          assignedTo: localStatus?.assignedTo || '',
          status: STATUS_MAP_TO_SHEET[localStatus?.status || 'not-started'],
          notes: localStatus?.notes || ''
        });
      });
    });

    // Send to Google Sheets
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'syncPages',
        pages: pages
      }),
      mode: 'no-cors' // Google Apps Script requires this
    });

    // Save last sync time
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    }

    return { success: true, pagesExported: pages.length };
  } catch (error) {
    console.error('Error exporting to Google Sheets:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Update a single page status in Google Sheets
 */
export async function updateStatusInSheet(
  pageUrl: string, 
  status: PageStatusType, 
  assignedTo: string, 
  notes?: string
): Promise<boolean> {
  if (!GOOGLE_SCRIPT_URL) {
    console.log('Google Sheets not configured, saving locally only');
    return false;
  }

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updateStatus',
        pageUrl: pageUrl,
        status: STATUS_MAP_TO_SHEET[status],
        assignedTo: assignedTo,
        notes: notes
      }),
      mode: 'no-cors'
    });

    return true;
  } catch (error) {
    console.error('Error updating Google Sheets:', error);
    return false;
  }
}

/**
 * Add team member to Google Sheets
 */
export async function addTeamMemberToSheet(name: string): Promise<boolean> {
  if (!GOOGLE_SCRIPT_URL) return false;

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'addTeamMember',
        name: name
      }),
      mode: 'no-cors'
    });
    return true;
  } catch (error) {
    console.error('Error adding team member to sheet:', error);
    return false;
  }
}

/**
 * Read statuses from Google Sheets (via published CSV)
 */
export async function fetchStatusesFromSheet(): Promise<Record<string, { status: PageStatusType; assignedTo: string; notes: string }>> {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${STATUS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Status`;
    
    const response = await fetch(url, { cache: 'no-store' });
    
    if (!response.ok) {
      console.warn('Could not fetch from Google Sheets');
      return {};
    }
    
    const csvText = await response.text();
    
    // Check if HTML (sheet not published)
    if (csvText.includes('<!DOCTYPE') || csvText.includes('<html')) {
      console.warn('Sheet not published. Go to File → Share → Publish to web');
      return {};
    }
    
    const rows = parseCSV(csvText);
    const statuses: Record<string, { status: PageStatusType; assignedTo: string; notes: string }> = {};
    
    // Skip header row, parse data
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 5) {
        // Column B (Page) contains hyperlink, we need to extract URL
        // For now, we'll match by page title since URL is in formula
        const siteName = row[0];
        const pageTitle = row[1];
        const assignedTo = row[2] || '';
        const statusText = row[3] || 'Not Started';
        const notes = row[4] || '';
        
        // We'll use a combination key for matching
        const key = `${siteName}|${pageTitle}`;
        statuses[key] = {
          status: STATUS_MAP_FROM_SHEET[statusText] || 'not-started',
          assignedTo,
          notes
        };
      }
    }
    
    return statuses;
  } catch (error) {
    console.error('Error fetching from Google Sheets:', error);
    return {};
  }
}

/**
 * Parse CSV text into 2D array
 */
function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      }
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      currentCell += char;
    }
  }
  
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell !== '')) {
      rows.push(currentRow);
    }
  }
  
  return rows;
}

// ============================================
// LOCAL STORAGE FUNCTIONS
// ============================================

/**
 * Save page status to localStorage AND sync to Google Sheets
 */
export function savePageStatusLocal(pageUrl: string, status: {
  status: PageStatusType;
  assignedTo: string;
  notes: string;
}): void {
  if (typeof window === 'undefined') return;
  
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAGE_STATUSES) || '{}');
  existing[pageUrl] = {
    ...status,
    updatedDate: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEYS.PAGE_STATUSES, JSON.stringify(existing));

  // Also sync to Google Sheets (fire and forget)
  updateStatusInSheet(pageUrl, status.status, status.assignedTo, status.notes);
}

/**
 * Get all page statuses from localStorage
 */
export function getAllPageStatusesLocal(): Record<string, {
  status: PageStatusType;
  assignedTo: string;
  notes: string;
  updatedDate: string;
}> {
  if (typeof window === 'undefined') return {};
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.PAGE_STATUSES) || '{}');
}

/**
 * Save team members to localStorage AND sync to Google Sheets
 */
export function saveTeamMembersLocal(members: TeamMember[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.TEAM_MEMBERS, JSON.stringify(members));
}

/**
 * Get team members from localStorage
 */
export function getTeamMembersLocal(): TeamMember[] {
  if (typeof window === 'undefined') return [];
  
  const stored = localStorage.getItem(STORAGE_KEYS.TEAM_MEMBERS);
  if (stored) {
    return JSON.parse(stored);
  }
  
  // Default team members
  return [
    { name: 'Noah', email: '', role: 'Team Member' },
    { name: 'Abhi', email: '', role: 'Team Member' },
    { name: 'Ayush', email: '', role: 'Team Member' },
  ];
}

/**
 * Add team member locally and to sheet
 */
export function addTeamMember(name: string): TeamMember[] {
  const members = getTeamMembersLocal();
  const newMember: TeamMember = { name, email: '', role: 'Team Member' };
  members.push(newMember);
  saveTeamMembersLocal(members);
  
  // Sync to sheet
  addTeamMemberToSheet(name);
  
  return members;
}

/**
 * Remove team member
 */
export function removeTeamMember(name: string): TeamMember[] {
  const members = getTeamMembersLocal().filter(m => m.name !== name);
  saveTeamMembersLocal(members);
  return members;
}

// ============================================
// SCAN RESULTS FUNCTIONS
// ============================================

export function saveScanResultLocal(result: ScanResultData): void {
  if (typeof window === 'undefined') return;
  
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCAN_RESULTS) || '[]');
  existing.unshift(result);
  
  const trimmed = existing.slice(0, 100);
  localStorage.setItem(STORAGE_KEYS.SCAN_RESULTS, JSON.stringify(trimmed));
}

export function getScanResultsLocal(): ScanResultData[] {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.SCAN_RESULTS) || '[]');
}

export function getLatestScanForPageLocal(pageUrl: string): ScanResultData | null {
  const results = getScanResultsLocal();
  const pageResults = results
    .filter(r => r.pageUrl === pageUrl)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return pageResults[0] || null;
}

// ============================================
// LAST SYNC INFO
// ============================================

export function getLastSyncTime(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
}