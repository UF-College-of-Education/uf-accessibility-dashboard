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

// All Google Sheets communication goes through /api/sheets server-side proxy.
// This avoids CORS issues, redirect issues, and removes the need for
// the client to know the Google Script URL.

/**
 * POST to Google Apps Script via server-side proxy.
 */
async function postToGoogleScript(data: Record<string, unknown>): Promise<boolean> {
  try {
    const response = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (!result.success) {
      console.error('Google Sheets POST failed:', result.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Google Sheets POST error:', error);
    return false;
  }
}

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
 * Always true now — the server-side proxy handles the URL.
 */
export function isGoogleSheetsConfigured(): boolean {
  return true;
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
  try {
    // Fetch via server-side proxy to avoid CORS issues
    const response = await fetch(`/api/sheets?action=getAllData`, {
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
            const newStatus = STATUS_MAP_FROM_SHEET[row.status] || STATUS_MAP_FROM_SHEET[row.status?.toLowerCase()] || 'not-started';
            const existing = statuses[row.url];

            // If this URL already has a real status, don't overwrite with "not-started"
            // This handles duplicate rows in the sheet where old rows still say Not Started
            if (existing && existing.status !== 'not-started' && newStatus === 'not-started') {
              return; // Keep the existing non-default status
            }

            statuses[row.url] = {
              status: newStatus,
              assignedTo: row.assignedTo || existing?.assignedTo || '',
              notes: row.notes || existing?.notes || '',
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
        const newStatus = STATUS_MAP_FROM_SHEET[status] || STATUS_MAP_FROM_SHEET[status?.toLowerCase()] || 'not-started';
        const existing = statuses[pageUrl];

        // Don't let duplicate "Not Started" rows overwrite real statuses
        if (existing && existing.status !== 'not-started' && newStatus === 'not-started') {
          continue;
        }

        statuses[pageUrl] = {
          status: newStatus,
          assignedTo: assignedTo || existing?.assignedTo || '',
          notes: notes || existing?.notes || '',
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
  try {
    // Get current statuses from localStorage
    const localStatuses = getAllPageStatusesLocal();

    // Only export pages that have actual status changes (not "not-started" with no assignment)
    // This avoids sending thousands of empty rows and timing out
    const pagesToSync: { url: string; status: string; assignedTo: string; notes: string }[] = [];

    sites.forEach(site => {
      site.pages.forEach(page => {
        const localStatus = localStatuses[page.url];
        if (localStatus && (localStatus.status !== 'not-started' || localStatus.assignedTo || localStatus.notes)) {
          pagesToSync.push({
            url: page.url,
            status: STATUS_MAP_TO_SHEET[localStatus.status],
            assignedTo: localStatus.assignedTo || '',
            notes: localStatus.notes || '',
          });
        }
      });
    });

    console.log(`Exporting ${pagesToSync.length} pages with status changes...`);

    // Send in batches of 50 to avoid timeouts
    const BATCH_SIZE = 50;
    let exported = 0;
    for (let i = 0; i < pagesToSync.length; i += BATCH_SIZE) {
      const batch = pagesToSync.slice(i, i + BATCH_SIZE);
      // Send each page as individual updateStatus calls in parallel (within batch)
      await Promise.all(
        batch.map(page =>
          postToGoogleScript({
            action: 'updateStatus',
            pageUrl: page.url,
            status: page.status,
            assignedTo: page.assignedTo,
            notes: page.notes,
          })
        )
      );
      exported += batch.length;
      console.log(`Exported batch ${Math.floor(i / BATCH_SIZE) + 1}: ${exported}/${pagesToSync.length}`);
    }

    // Save last sync time
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    }

    return { success: true, pagesExported: exported };
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
  try {
    const success = await postToGoogleScript({
      action: 'updateStatus',
      pageUrl: pageUrl,
      status: STATUS_MAP_TO_SHEET[status],
      assignedTo: assignedTo,
      notes: notes || ''
    });

    if (success) {
      console.log('✅ Status synced to Google Sheets for:', pageUrl);
    }
    return success;
  } catch (error) {
    console.error('Error updating Google Sheets:', error);
    return false;
  }
}

/**
 * Add team member to Google Sheets
 */
export async function addTeamMemberToSheet(name: string): Promise<boolean> {
  try {
    return await postToGoogleScript({ action: 'addTeamMember', name });
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
  try {
    return await postToGoogleScript({
      action: 'updateSitePriority',
      siteId: siteId,
      priority: priority
    });
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

  // Sync to Google Sheets with logging
  console.log('📤 Syncing to Google Sheets:', pageUrl, status.status, status.assignedTo);
  updateStatusInSheet(pageUrl, status.status, status.assignedTo, status.notes)
    .then(success => {
      if (success) {
        console.log('✅ Saved to Google Sheets:', pageUrl);
      } else {
        console.error('❌ Failed to save to Google Sheets:', pageUrl);
      }
    })
    .catch(err => {
      console.error('❌ Error saving to Google Sheets:', pageUrl, err);
    });
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
 * Google Sheets is the single source of truth.
 * Sheet data ALWAYS overwrites localStorage to ensure all browsers see the same data.
 */
export function mergeSheetDataIntoLocal(sheetStatuses: Record<string, { status: PageStatusType; assignedTo: string; notes: string }>): void {
  if (typeof window === 'undefined') return;

  // Start fresh from sheet data — Google Sheets is the source of truth
  const merged: Record<string, { status: PageStatusType; assignedTo: string; notes: string; updatedDate: string }> = {};

  // Write all sheet data
  Object.keys(sheetStatuses).forEach(url => {
    merged[url] = {
      ...sheetStatuses[url],
      updatedDate: new Date().toISOString(),
    };
  });

  localStorage.setItem(STORAGE_KEYS.PAGE_STATUSES, JSON.stringify(merged));
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