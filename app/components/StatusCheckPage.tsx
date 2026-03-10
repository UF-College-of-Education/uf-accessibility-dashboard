// app/components/StatusCheckPage.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Shield, Activity, Search, ExternalLink } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import StatCards from '@/components/dashboard/stat-cards';
import TeamMembers from '@/components/dashboard/team-members';
import SyncHeader from '@/components/dashboard/sync-header';
import SiteCard from '@/components/dashboard/site-card';
import NotesDialog from '@/components/dashboard/notes-dialog';
import ReportDialog from '@/components/dashboard/report-dialog';
import StatusLegend from '@/components/dashboard/status-legend';
import TeamProgress from '@/components/dashboard/team-progress';
import BallCursor from '@/components/ball-cursor';
import InteractiveBackground from '@/components/interactive-background';
import {
  PageStatusType,
  STATUS_OPTIONS,
  ScanResultData,
  SiteData,
  TeamMember,
  getTeamMembersLocal,
  saveTeamMembersLocal,
  getAllPageStatusesLocal,
  savePageStatusLocal,
  getLatestScanForPageLocal,
  exportAllPagesToSheet,
  isGoogleSheetsConfigured,
  getLastSyncTime,
  setLastSyncTime,
  addTeamMember as addTeamMemberService,
  removeTeamMember as removeTeamMemberService,
  fetchAllDataFromSheet,
  mergeSheetDataIntoLocal,
  getAllSitePrioritiesLocal,
  saveSitePriorityLocal,
  getSitePriority,
  sortSitesByPriority,
  mergeSitePrioritiesIntoLocal,
} from './GoogleSheetsService';
import {
  syncAllSiteimproveData,
  getSiteimproveDataLocal,
  type SiteimproveData,
} from './SiteimproveService';

interface Props {
  sites: SiteData[];
}

interface LocalStatus {
  status: PageStatusType;
  assignedTo: string;
  notes: string;
  updatedDate: string;
}

export default function StatusCheckPage({ sites }: Props) {
  // ============================================
  // STATE — ALL YOUR ORIGINAL STATE PRESERVED
  // ============================================
  const [pageStatuses, setPageStatuses] = useState<Record<string, LocalStatus>>({});
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [sitePriorities, setSitePriorities] = useState<Record<string, 1 | 2 | 3 | 4 | null>>({});
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTimeState] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'loading' | 'connected' | 'offline'>('loading');
  const [searchQuery, setSearchQuery] = useState('');

  // Siteimprove state
  const [siteimproveStatus, setSiteimproveStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [siteimproveMessage, setSiteimproveMessage] = useState('');
  const [siteimproveData, setSiteimproveData] = useState<SiteimproveData | null>(null);

  // Dialog state (V0 style)
  const [notesDialog, setNotesDialog] = useState({
    isOpen: false,
    pageUrl: '',
    pageTitle: '',
    notes: '',
  });
  const [reportDialog, setReportDialog] = useState<{
    isOpen: boolean;
    pageTitle: string;
    scanData: ScanResultData | null;
  }>({
    isOpen: false,
    pageTitle: '',
    scanData: null,
  });

  // ============================================
  // LOAD DATA — YOUR ORIGINAL CLOUD SYNC LOGIC
  // ============================================
  useEffect(() => {
    loadDataFromCloud();
    // Load cached Siteimprove data immediately, then auto-sync fresh data
    const cached = getSiteimproveDataLocal();
    if (cached) {
      setSiteimproveData(cached);
    }
    // Auto-sync Siteimprove data (uses cache if less than 1 hour old)
    handleSiteimproveSync(false);
  }, []);

  async function loadDataFromCloud() {
    setLoading(true);
    setCloudStatus('loading');

    try {
      const sheetData = await fetchAllDataFromSheet();

      if (sheetData.success && Object.keys(sheetData.statuses).length > 0) {
        console.log('✅ Cloud data loaded');
        mergeSheetDataIntoLocal(sheetData.statuses);

        if (sheetData.sitePriorities) {
          mergeSitePrioritiesIntoLocal(sheetData.sitePriorities);
        }

        if (sheetData.teamMembers && sheetData.teamMembers.length > 0) {
          const existing = getTeamMembersLocal();
          const allNames = new Set([...existing.map(m => m.name), ...sheetData.teamMembers]);
          const mergedMembers = Array.from(allNames).map(name => ({
            name,
            email: '',
            role: 'Team Member'
          }));
          saveTeamMembersLocal(mergedMembers);
        }

        setCloudStatus('connected');
        setLastSyncTime();
      } else {
        console.log('ℹ️ No cloud data, using local');
        setCloudStatus('offline');
      }

      const statuses = getAllPageStatusesLocal();
      const members = getTeamMembersLocal();
      const lastSync = getLastSyncTime();

      const priorities = getAllSitePrioritiesLocal();
      const prioritiesMap: Record<string, 1 | 2 | 3 | 4 | null> = {};
      Object.values(priorities).forEach(p => {
        prioritiesMap[p.siteId] = p.priority;
      });

      setPageStatuses(statuses);
      setTeamMembers(members);
      setLastSyncTimeState(lastSync ? new Date(lastSync).toLocaleString() : 'Never');
      setSitePriorities(prioritiesMap);
    } catch (error) {
      console.error('Error loading data:', error);
      setCloudStatus('offline');

      const statuses = getAllPageStatusesLocal();
      const members = getTeamMembersLocal();
      const priorities = getAllSitePrioritiesLocal();
      const prioritiesMap: Record<string, 1 | 2 | 3 | 4 | null> = {};
      Object.values(priorities).forEach(p => {
        prioritiesMap[p.siteId] = p.priority;
      });

      setPageStatuses(statuses);
      setTeamMembers(members);
      setSitePriorities(prioritiesMap);
    } finally {
      setLoading(false);
    }
  }

  // ============================================
  // HANDLERS — YOUR ORIGINAL LOGIC PRESERVED
  // ============================================
  async function handleRefresh() {
    await loadDataFromCloud();
  }

  async function handleExport() {
    setExporting(true);
    setExportSuccess(false);

    try {
      const result = await exportAllPagesToSheet(sites);
      if (result.success) {
        setExportSuccess(true);
        setLastSyncTimeState(new Date().toLocaleString());
        setCloudStatus('connected');
        setTimeout(() => setExportSuccess(false), 3000);
        alert(`✅ Successfully exported ${result.pagesExported} pages to Google Sheets!`);
      } else {
        alert(`❌ Export failed: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Export failed: ${error}`);
    } finally {
      setExporting(false);
    }
  }

  function updateStatus(pageUrl: string, newStatus: PageStatusType) {
    const currentStatus = pageStatuses[pageUrl] || {
      status: 'not-started',
      assignedTo: '',
      notes: '',
      updatedDate: ''
    };

    const updated: LocalStatus = {
      ...currentStatus,
      status: newStatus,
      assignedTo: newStatus === 'not-started' ? '' : currentStatus.assignedTo,
      updatedDate: new Date().toISOString(),
    };

    savePageStatusLocal(pageUrl, {
      status: updated.status,
      assignedTo: updated.assignedTo,
      notes: updated.notes,
    });

    setPageStatuses(prev => ({ ...prev, [pageUrl]: updated }));
  }

  function updateAssignment(pageUrl: string, assignedTo: string) {
    const currentStatus = pageStatuses[pageUrl] || {
      status: 'not-started',
      assignedTo: '',
      notes: '',
      updatedDate: ''
    };

    const updated: LocalStatus = {
      ...currentStatus,
      assignedTo,
      updatedDate: new Date().toISOString(),
    };

    savePageStatusLocal(pageUrl, {
      status: updated.status,
      assignedTo: updated.assignedTo,
      notes: updated.notes,
    });

    setPageStatuses(prev => ({ ...prev, [pageUrl]: updated }));
  }

  function updatePriority(siteId: string, priority: 1 | 2 | 3 | 4 | null) {
    saveSitePriorityLocal(siteId, priority);
    setSitePriorities(prev => ({ ...prev, [siteId]: priority }));
  }

  function handleAddTeamMember(name: string) {
    const updated = addTeamMemberService(name);
    setTeamMembers(updated);
  }

  function handleRemoveTeamMember(name: string) {
    const updated = removeTeamMemberService(name);
    setTeamMembers(updated);
  }

  function openNotes(pageUrl: string, pageTitle: string) {
    setNotesDialog({
      isOpen: true,
      pageUrl,
      pageTitle,
      notes: pageStatuses[pageUrl]?.notes || '',
    });
  }

  function saveNotes(pageUrl: string, notes: string) {
    const currentStatus = pageStatuses[pageUrl] || {
      status: 'not-started',
      assignedTo: '',
      notes: '',
      updatedDate: ''
    };

    const updated: LocalStatus = {
      ...currentStatus,
      notes,
      updatedDate: new Date().toISOString(),
    };

    savePageStatusLocal(pageUrl, {
      status: updated.status,
      assignedTo: updated.assignedTo,
      notes: updated.notes,
    });

    setPageStatuses(prev => ({ ...prev, [pageUrl]: updated }));
    setNotesDialog({ isOpen: false, pageUrl: '', pageTitle: '', notes: '' });
  }

  function openReport(pageUrl: string, pageTitle: string) {
    const scanData = getLatestScanForPageLocal(pageUrl);
    setReportDialog({
      isOpen: true,
      pageTitle,
      scanData,
    });
  }

  const getScanData = useCallback(
    (pageUrl: string): ScanResultData | null => {
      return getLatestScanForPageLocal(pageUrl);
    },
    []
  );

  // Siteimprove sync — fetches all sites, cached for 1 hour, no Google Sheets
  async function handleSiteimproveSync(force: boolean = true) {
    setSiteimproveStatus('syncing');
    setSiteimproveMessage('Checking Siteimprove data...');

    try {
      const result = await syncAllSiteimproveData(
        (msg) => setSiteimproveMessage(msg),
        force
      );
      setSiteimproveData(result);
      setSiteimproveStatus('done');
      setTimeout(() => setSiteimproveStatus('idle'), 5000);
    } catch (error) {
      console.error('Siteimprove sync error:', error);
      setSiteimproveStatus('error');
      setSiteimproveMessage(`Error: ${error}`);
      setTimeout(() => setSiteimproveStatus('idle'), 5000);
    }
  }

  // ============================================
  // COMPUTED VALUES
  // ============================================
  const totalPages = sites.reduce((sum, s) => sum + s.pages.length, 0);
  const completedPages = Object.values(pageStatuses).filter(s => s.status === 'completed').length;
  const completedSites = sites.filter(site =>
    site.pages.length > 0 && site.pages.every(p => pageStatuses[p.url]?.status === 'completed')
  ).length;
  const archivedPages = Object.values(pageStatuses).filter(s => s.status === 'archived').length;
  const archivePendingPages = Object.values(pageStatuses).filter(s => s.status === 'archive-pending').length;
  const archivedSites = sites.filter(site =>
    site.pages.length > 0 && site.pages.every(p => pageStatuses[p.url]?.status === 'archived')
  ).length;
  const archivePendingSites = sites.filter(site =>
    site.pages.some(p => pageStatuses[p.url]?.status === 'archive-pending') &&
    !site.pages.every(p => pageStatuses[p.url]?.status === 'archived')
  ).length;

  // Sort + filter sites
  const sortedSites = useMemo(() => {
    const filtered = searchQuery
      ? sites.filter(
          s =>
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.baseUrl.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : sites;

    return [...filtered].sort((a, b) => {
      const pa = sitePriorities[a.id] ?? 99;
      const pb = sitePriorities[b.id] ?? 99;
      return pa - pb;
    });
  }, [sites, sitePriorities, searchQuery]);

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        <span className="mt-3 text-gray-600">Loading from Google Sheets...</span>
        <span className="text-sm text-gray-400 mt-1">Syncing latest data...</span>
      </div>
    );
  }

  // ============================================
  // RENDER — V0's NEW UI LAYOUT
  // ============================================
  return (
    <TooltipProvider>
      <BallCursor />
      <InteractiveBackground />
      <div className="relative z-10 min-h-screen bg-transparent" style={{ cursor: 'none' }}>
        {/* Top banner */}
        <header className="relative overflow-hidden border-b border-white/[0.06]">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-cyan-600/5" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center gap-4 mb-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25 animate-float">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-400 tracking-widest uppercase mb-0.5">
                  UF College of Education
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
                  Accessibility Audit Dashboard — Status Check
                </h1>
              </div>
              <div className="ml-auto hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-400">
                  {cloudStatus === 'connected' ? 'Live' : cloudStatus === 'loading' ? 'Syncing' : 'Offline'}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1 ml-16 max-w-xl leading-relaxed">
              Track completion status for all sites and pages
            </p>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Stat cards */}
          <StatCards
            completedSites={completedSites}
            totalSites={sites.length}
            completedPages={completedPages}
            totalPages={totalPages}
            archivedSites={archivedSites}
            archivePendingSites={archivePendingSites}
            archivedPages={archivedPages}
            archivePendingPages={archivePendingPages}
          />

          {/* Team members */}
          <TeamMembers
            members={teamMembers}
            onAdd={handleAddTeamMember}
            onRemove={handleRemoveTeamMember}
          />

          {/* Team Progress Dashboard */}
          <div className="space-y-2">
            <div className="flex justify-end">
              <a
                href="/team-progress"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Full Progress View
              </a>
            </div>
            <TeamProgress
              pageStatuses={pageStatuses}
              teamMembers={teamMembers}
              sites={sites}
            />
          </div>

          {/* Sync + Search */}
          <SyncHeader
            cloudStatus={cloudStatus}
            lastSyncTime={lastSyncTime}
            exporting={exporting}
            exportSuccess={exportSuccess}
            loading={loading}
            searchQuery={searchQuery}
            onRefresh={handleRefresh}
            onExport={handleExport}
            onSearchChange={setSearchQuery}
            siteimproveStatus={siteimproveStatus}
            siteimproveMessage={siteimproveMessage}
            onSiteimproveSync={handleSiteimproveSync}
          />

          {/* Sites list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1 animate-fade-in-up" style={{ animationDelay: '600ms' }}>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                All Sites
                <span className="text-xs font-mono text-muted-foreground bg-white/[0.06] px-2 py-0.5 rounded-full">
                  {sortedSites.length}
                </span>
              </h2>
            </div>

            {sortedSites.length === 0 && (
              <div className="text-center py-16 text-muted-foreground rounded-xl border border-white/[0.06] glass">
                <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No sites match your search.</p>
              </div>
            )}

            {sortedSites.map((site) => (
              <div
                key={site.id}
              >
                <SiteCard
                  site={site}
                  pageStatuses={pageStatuses}
                  sitePriority={sitePriorities[site.id] ?? null}
                  teamMembers={teamMembers}
                  onUpdateStatus={updateStatus}
                  onUpdateAssignment={updateAssignment}
                  onUpdatePriority={updatePriority}
                  onOpenNotes={openNotes}
                  onOpenReport={openReport}
                  getScanData={getScanData}
                  siteimproveData={siteimproveData}
                />
              </div>
            ))}
          </div>

          {/* Status Legend */}
          <StatusLegend />
        </main>

        {/* Dialogs */}
        <NotesDialog
          isOpen={notesDialog.isOpen}
          pageUrl={notesDialog.pageUrl}
          pageTitle={notesDialog.pageTitle}
          initialNotes={notesDialog.notes}
          onClose={() => setNotesDialog({ isOpen: false, pageUrl: '', pageTitle: '', notes: '' })}
          onSave={saveNotes}
        />

        <ReportDialog
          isOpen={reportDialog.isOpen}
          pageTitle={reportDialog.pageTitle}
          scanData={reportDialog.scanData}
          onClose={() => setReportDialog({ isOpen: false, pageTitle: '', scanData: null })}
        />
      </div>
    </TooltipProvider>
  );
}