// app/components/GoogleSheetsService.ts

/**
 * Google Sheets Integration Service
 * 
 * This service handles:
 * 1. Exporting ALL pages from dashboard to Google Sheets
 * 2. Syncing status changes from website to sheet
 * 3. Reading status from sheet back to website (AUTO-LOAD ON PAGE OPEN)
 * 4. Site Prioritization (NEW) - Priority 1,2,3,4 for sites
 * 
 * SETUP REQUIRED:
 * Add to .env.local AND Vercel Environment Variables:
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
// STATUS OPTIONS - UPDATED WITH ARCHIVE
// ============================================

export type PageStatusType = 'not-started' | 'working' | 'issues' | 'completed' | 'archive-pending' | 'archived';

// Map between dashboard values and sheet values
const STATUS_MAP_TO_SHEET: Record<PageStatusType, string> = {
  'not-started': 'Not Started',
  'working': 'Working on it',
  'issues': 'Facing Issues',
  'completed': 'Completed',
  'archive-pending': 'Archive It',
  'archived': 'Archived'
};

const STATUS_MAP_FROM_SHEET: Record<string, PageStatusType> = {
  'Not Started': 'not-started',
  'Working on it': 'working',
  'Facing Issues': 'issues',
  'Completed': 'completed',
  'Archive It': 'archive-pending',
  'Archived': 'archived',
  // Also handle lowercase variants
  'not started': 'not-started',
  'working on it': 'working',
  'facing issues': 'issues',
  'completed': 'completed',
  'archive it': 'archive-pending',
  'archived': 'archived',
};

export const STATUS_OPTIONS: { value: PageStatusType; label: string; color: string; bgColor: string }[] = [
  { value: 'not-started', label: 'Not Started', color: 'text-gray-900', bgColor: 'bg-gray-100' },
  { value: 'working', label: 'Working on it', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  { value: 'issues', label: 'Facing Issues', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  { value: 'completed', label: 'Completed', color: 'text-green-600', bgColor: 'bg-green-100' },
  { value: 'archive-pending', label: 'Archive It', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  { value: 'archived', label: 'Archived', color: 'text-red-600', bgColor: 'bg-red-100' },
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

export interface SitePriority {
  siteId: string;
  priority: 1 | 2 | 3 | 4 | null;
  updatedDate: string;
}

// ============================================
// LOCAL STORAGE KEYS
// ============================================

const STORAGE_KEYS = {
  PAGE_STATUSES: 'uf-accessibility-page-statuses',
  TEAM_MEMBERS: 'uf-accessibility-team-members',
  SCAN_RESULTS: 'uf-accessibility-scan-results',
  LAST_SYNC: 'uf-accessibility-last-sync',
  SITE_PRIORITIES: 'uf-accessibility-site-priorities',
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
 * ⭐ Fetch ALL data from Google Sheets on page load
 * This is the key function that enables sharing data between users!
 */
export async function fetchAllDataFromSheet(): Promise<{
  success: boolean;
  statuses: Record<string, { status: PageStatusType; assignedTo: string; notes: string }>;
  teamMembers: string[];
  sitePriorities?: Record<string, { priority: 1 | 2 | 3 | 4 | null }>;
  error?: string;
}> {
  if (!GOOGLE_SCRIPT_URL) {
    console.log('Google Sheets not configured, using local data only');
    return { success: false, statuses: {}, teamMembers: [], sitePriorities: {}, error: 'Not configured' };
  }

  try {
    // Use the Apps Script to fetch data (this avoids CORS issues)
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAllData&t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      console.log('✅ Loaded data from Google Sheets:', data);
      
      // Convert sheet data to our format
      const statuses: Record<string, { status: PageStatusType; assignedTo: string; notes: string }> = {};
      
      if (data.pages && Array.isArray(data.pages)) {
        data.pages.forEach((row: any) => {
          if (row.url) {
            statuses[row.url] = {
              status: STATUS_MAP_FROM_SHEET[row.status] || STATUS_MAP_FROM_SHEET[row.status?.toLowerCase()] || 'not-started',
              assignedTo: row.assignedTo || '',
              notes: row.notes || '',
            };
          }
        });
      }

      // Convert site priorities
      const sitePriorities: Record<string, { priority: 1 | 2 | 3 | 4 | null }> = {};
      if (data.sitePriorities && typeof data.sitePriorities === 'object') {
        Object.keys(data.sitePriorities).forEach(siteId => {
          sitePriorities[siteId] = {
            priority: data.sitePriorities[siteId].priority || null
          };
        });
      }

      return {
        success: true,
        statuses,
        teamMembers: data.teamMembers || [],
        sitePriorities,
      };
    }

    return { success: false, statuses: {}, teamMembers: [], sitePriorities: {}, error: data.error || 'Unknown error' };
  } catch (error) {
    console.error('Error fetching from Google Sheets:', error);
    
    // Fallback: Try CSV method
    console.log('Trying CSV fallback...');
    const csvStatuses = await fetchStatusesFromSheetCSV();
    
    return {
      success: Object.keys(csvStatuses).length > 0,
      statuses: csvStatuses,
      teamMembers: [],
      sitePriorities: {},
      error: Object.keys(csvStatuses).length > 0 ? undefined : String(error),
    };
  }
}

/**
 * Fallback: Read statuses from Google Sheets via published CSV
 */
async function fetchStatusesFromSheetCSV(): Promise<Record<string, { status: PageStatusType; assignedTo: string; notes: string }>> {
  try {
    // Try to read from published CSV
    const url = `https://docs.google.com/spreadsheets/d/${STATUS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Status&t=${Date.now()}`;
    
    const response = await fetch(url, { 
      cache: 'no-store',
      headers: {
        'Accept': 'text/csv',
      }
    });
    
    if (!response.ok) {
      console.warn('Could not fetch CSV from Google Sheets');
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
    
    // Find column indices from header row
    const headerRow = rows[0] || [];
    const urlColIndex = headerRow.findIndex(h => h.toLowerCase().includes('url') || h.toLowerCase().includes('page'));
    const statusColIndex = headerRow.findIndex(h => h.toLowerCase().includes('status'));
    const assignedColIndex = headerRow.findIndex(h => h.toLowerCase().includes('assigned'));
    const notesColIndex = headerRow.findIndex(h => h.toLowerCase().includes('notes'));
    
    // Skip header row, parse data
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // Try to extract URL - it might be in a HYPERLINK formula
      let pageUrl = '';
      
      if (urlColIndex >= 0 && row[urlColIndex]) {
        const cellValue = row[urlColIndex];
        // Check if it's a hyperlink formula: =HYPERLINK("url", "title")
        const hyperlinkMatch = cellValue.match(/=HYPERLINK\s*\(\s*"([^"]+)"/i);
        if (hyperlinkMatch) {
          pageUrl = hyperlinkMatch[1];
        } else if (cellValue.startsWith('http')) {
          pageUrl = cellValue;
        }
      }
      
      // Also check column C (index 2) for URL as that's common
      if (!pageUrl && row[2] && row[2].startsWith('http')) {
        pageUrl = row[2];
      }
      
      if (pageUrl) {
        const status = statusColIndex >= 0 ? row[statusColIndex] : '';
        const assignedTo = assignedColIndex >= 0 ? row[assignedColIndex] : '';
        const notes = notesColIndex >= 0 ? row[notesColIndex] : '';
        
        statuses[pageUrl] = {
          status: STATUS_MAP_FROM_SHEET[status] || STATUS_MAP_FROM_SHEET[status?.toLowerCase()] || 'not-started',
          assignedTo: assignedTo || '',
          notes: notes || '',
        };
      }
    }
    
    console.log('✅ Loaded from CSV:', Object.keys(statuses).length, 'pages');
    return statuses;
  } catch (error) {
    console.error('Error fetching CSV from Google Sheets:', error);
    return {};
  }
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
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'syncPages',
        pages: pages
      }),
      redirect: 'follow' // Google Apps Script requires this
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
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'updateStatus',
        pageUrl: pageUrl,
        status: STATUS_MAP_TO_SHEET[status],
        assignedTo: assignedTo,
        notes: notes || ''
      }),
      redirect: 'follow'
    });

    if (!response.ok) {
      console.error('Google Sheets update failed:', response.status);
      return false;
    }

    console.log('✅ Status synced to Google Sheets for:', pageUrl);
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
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'addTeamMember',
        name: name
      }),
      redirect: 'follow'
    });
    return true;
  } catch (error) {
    console.error('Error adding team member to sheet:', error);
    return false;
  }
}

/**
 * ⭐ NEW: Update site priority in Google Sheets
 */
export async function updateSitePriorityInSheet(
  siteId: string,
  priority: 1 | 2 | 3 | 4 | null
): Promise<boolean> {
  if (!GOOGLE_SCRIPT_URL) {
    console.log('Google Sheets not configured, saving locally only');
    return false;
  }

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'updateSitePriority',
        siteId: siteId,
        priority: priority
      }),
      redirect: 'follow'
    });

    return true;
  } catch (error) {
    console.error('Error updating site priority in Google Sheets:', error);
    return false;
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
 * ⭐ Merge sheet data into localStorage
 * This ensures everyone sees the same data
 */
export function mergeSheetDataIntoLocal(sheetStatuses: Record<string, { status: PageStatusType; assignedTo: string; notes: string }>): void {
  if (typeof window === 'undefined') return;

  const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAGE_STATUSES) || '{}');

  // Merge: Sheet data fills in missing entries, but does NOT overwrite
  // local changes that are newer (within last 5 minutes)
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

  Object.keys(sheetStatuses).forEach(url => {
    const local = existing[url];

    // If local entry exists and was updated recently, keep local version
    if (local && local.updatedDate) {
      const localTime = new Date(local.updatedDate).getTime();
      if (localTime > fiveMinutesAgo) {
        // Local is recent — keep it, don't overwrite
        return;
      }
    }

    // Otherwise, use sheet data
    existing[url] = {
      ...sheetStatuses[url],
      updatedDate: new Date().toISOString(),
    };
  });

  localStorage.setItem(STORAGE_KEYS.PAGE_STATUSES, JSON.stringify(existing));
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
// ⭐ NEW: SITE PRIORITY FUNCTIONS
// ============================================

/**
 * Get all site priorities from localStorage
 */
export function getAllSitePrioritiesLocal(): Record<string, SitePriority> {
  if (typeof window === 'undefined') return {};
  const stored = localStorage.getItem(STORAGE_KEYS.SITE_PRIORITIES);
  if (!stored) return {};

  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Error parsing site priorities:', e);
    return {};
  }
}

/**
 * Save site priority locally AND sync to Google Sheets
 */
export function saveSitePriorityLocal(
  siteId: string,
  priority: 1 | 2 | 3 | 4 | null
): void {
  if (typeof window === 'undefined') return;

  const existing = getAllSitePrioritiesLocal();
  existing[siteId] = {
    siteId,
    priority,
    updatedDate: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEYS.SITE_PRIORITIES, JSON.stringify(existing));

  // Also sync to Google Sheets (fire and forget)
  updateSitePriorityInSheet(siteId, priority);
}

/**
 * Get priority for a specific site
 */
export function getSitePriority(siteId: string): 1 | 2 | 3 | 4 | null {
  const priorities = getAllSitePrioritiesLocal();
  return priorities[siteId]?.priority || null;
}

/**
 * Merge sheet site priorities into localStorage
 */
export function mergeSitePrioritiesIntoLocal(
  sheetPriorities: Record<string, { priority: 1 | 2 | 3 | 4 | null }>
): void {
  if (typeof window === 'undefined') return;

  const existing = getAllSitePrioritiesLocal();

  Object.keys(sheetPriorities).forEach(siteId => {
    existing[siteId] = {
      siteId,
      priority: sheetPriorities[siteId].priority,
      updatedDate: new Date().toISOString(),
    };
  });

  localStorage.setItem(STORAGE_KEYS.SITE_PRIORITIES, JSON.stringify(existing));
}

/**
 * Sort sites by priority (1,2,3,4 first, then null at end)
 */
export function sortSitesByPriority(sites: SiteData[]): SiteData[] {
  const priorities = getAllSitePrioritiesLocal();

  return [...sites].sort((a, b) => {
    const priorityA = priorities[a.id]?.priority ?? 999;
    const priorityB = priorities[b.id]?.priority ?? 999;

    return priorityA - priorityB;
  });
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

export function setLastSyncTime(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
}