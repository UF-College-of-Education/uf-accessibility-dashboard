// app/components/StatusCheckPage.tsx

'use client';

import { useState, useEffect } from 'react';
import { Site } from './DataService';
import { 
  ChevronDown, 
  ChevronUp, 
  CheckCircle, 
  Circle,
  Clock,
  AlertTriangle,
  Users, 
  Plus, 
  RefreshCw,
  ExternalLink,
  Eye,
  X,
  FileText,
  Loader2,
  Save,
  MessageSquare,
  Upload,
  Check,
  Cloud,
  CloudOff
} from 'lucide-react';
import { 
  PageStatusType,
  STATUS_OPTIONS,
  ScanResultData,
  getTeamMembersLocal,
  saveTeamMembersLocal,
  getAllPageStatusesLocal,
  savePageStatusLocal,
  getLatestScanForPageLocal,
  TeamMember,
  exportAllPagesToSheet,
  isGoogleSheetsConfigured,
  getLastSyncTime,
  setLastSyncTime,
  addTeamMember as addTeamMemberService,
  removeTeamMember as removeTeamMemberService,
  fetchAllDataFromSheet,
  mergeSheetDataIntoLocal
} from './GoogleSheetsService';

interface Props {
  sites: Site[];
}

interface LocalStatus {
  status: PageStatusType;
  assignedTo: string;
  notes: string;
  updatedDate: string;
}

export default function StatusCheckPage({ sites }: Props) {
  const [expandedSite, setExpandedSite] = useState<string | null>(null);
  const [pageStatuses, setPageStatuses] = useState<Record<string, LocalStatus>>({});
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTimeState] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'loading' | 'connected' | 'offline'>('loading');
  
  // Notes popup state
  const [notesPopup, setNotesPopup] = useState<{
    isOpen: boolean;
    pageUrl: string;
    pageTitle: string;
    notes: string;
  }>({ isOpen: false, pageUrl: '', pageTitle: '', notes: '' });
  
  // View report popup state
  const [reportPopup, setReportPopup] = useState<{
    isOpen: boolean;
    pageUrl: string;
    pageTitle: string;
    scanData: ScanResultData | null;
  }>({ isOpen: false, pageUrl: '', pageTitle: '', scanData: null });

  // ⭐ AUTO-LOAD FROM GOOGLE SHEETS ON MOUNT
  useEffect(() => {
    loadDataFromCloud();
  }, []);

  /**
   * ⭐ NEW: Load data from Google Sheets first, then merge with local
   * This ensures everyone sees the same data!
   */
  async function loadDataFromCloud() {
    setLoading(true);
    setCloudStatus('loading');

    try {
      // First, try to fetch from Google Sheets
      const sheetData = await fetchAllDataFromSheet();
      
      if (sheetData.success && Object.keys(sheetData.statuses).length > 0) {
        console.log('✅ Cloud data loaded:', Object.keys(sheetData.statuses).length, 'pages');
        
        // Merge sheet data into localStorage (sheet takes precedence)
        mergeSheetDataIntoLocal(sheetData.statuses);
        
        // Update team members if we got any from sheet
        if (sheetData.teamMembers && sheetData.teamMembers.length > 0) {
          const members = sheetData.teamMembers.map(name => ({
            name,
            email: '',
            role: 'Team Member'
          }));
          // Merge with existing
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
        console.log('ℹ️ No cloud data or not configured, using local');
        setCloudStatus('offline');
      }
      
      // Now load from localStorage (which may have been updated with sheet data)
      const statuses = getAllPageStatusesLocal();
      const members = getTeamMembersLocal();
      const lastSync = getLastSyncTime();

      setPageStatuses(statuses);
      setTeamMembers(members);
      setLastSyncTimeState(lastSync ? new Date(lastSync).toLocaleString() : 'Never');
      
    } catch (error) {
      console.error('Error loading data:', error);
      setCloudStatus('offline');
      
      // Fall back to local data
      const statuses = getAllPageStatusesLocal();
      const members = getTeamMembersLocal();
      setPageStatuses(statuses);
      setTeamMembers(members);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    await loadDataFromCloud();
  }

  // Export ALL pages to Google Sheets
  async function handleExportToSheet() {
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

  // Update page status
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

    // Save locally AND sync to Google Sheets
    savePageStatusLocal(pageUrl, {
      status: updated.status,
      assignedTo: updated.assignedTo,
      notes: updated.notes,
    });

    setPageStatuses(prev => ({
      ...prev,
      [pageUrl]: updated
    }));
  }

  // Update assigned team member
  function updateAssignedTo(pageUrl: string, assignedTo: string) {
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

    // Save locally AND sync to Google Sheets
    savePageStatusLocal(pageUrl, {
      status: updated.status,
      assignedTo: updated.assignedTo,
      notes: updated.notes,
    });

    setPageStatuses(prev => ({
      ...prev,
      [pageUrl]: updated
    }));
  }

  // Update notes
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

    setPageStatuses(prev => ({
      ...prev,
      [pageUrl]: updated
    }));

    setNotesPopup({ isOpen: false, pageUrl: '', pageTitle: '', notes: '' });
  }

  // Open notes popup
  function openNotesPopup(pageUrl: string, pageTitle: string) {
    const currentNotes = pageStatuses[pageUrl]?.notes || '';
    setNotesPopup({
      isOpen: true,
      pageUrl,
      pageTitle,
      notes: currentNotes
    });
  }

  // Open report popup
  function openReportPopup(pageUrl: string, pageTitle: string) {
    const scanData = getLatestScanForPageLocal(pageUrl);
    setReportPopup({
      isOpen: true,
      pageUrl,
      pageTitle,
      scanData
    });
  }

  // Team member functions
  function addTeamMember() {
    if (!newMemberName.trim()) return;
    
    const updated = addTeamMemberService(newMemberName.trim());
    setTeamMembers(updated);
    setNewMemberName('');
    setShowAddMember(false);
  }

  function removeTeamMember(name: string) {
    const updated = removeTeamMemberService(name);
    setTeamMembers(updated);
  }

  // Get status icon
  function getStatusIcon(status: PageStatusType) {
    switch (status) {
      case 'completed':
        return <CheckCircle className="text-green-600 flex-shrink-0" size={20} />;
      case 'working':
        return <Clock className="text-blue-600 flex-shrink-0" size={20} />;
      case 'issues':
        return <AlertTriangle className="text-orange-600 flex-shrink-0" size={20} />;
      case 'archive-pending':
        return <Circle className="text-indigo-600 flex-shrink-0" size={20} style={{ fill: '#4f46e5' }} />;
      case 'archived':
        return <Circle className="text-red-600 flex-shrink-0" size={20} style={{ fill: '#dc2626' }} />;
      default:
        return <Circle className="text-gray-400 flex-shrink-0" size={20} />;
    }
  }

  // Get status style
  function getStatusStyle(status: PageStatusType) {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    return option || STATUS_OPTIONS[0];
  }

  // Calculate stats
  const totalPages = sites.reduce((sum, site) => sum + site.pages.length, 0);
  const completedPages = Object.values(pageStatuses).filter(s => s.status === 'completed').length;
  const completedSites = sites.filter(site => 
    site.pages.length > 0 && site.pages.every(page => pageStatuses[page.url]?.status === 'completed')
  ).length;

  // ⭐ NEW: Calculate archive stats
  const archivedPages = Object.values(pageStatuses).filter(s => s.status === 'archived').length;
  const archivePendingPages = Object.values(pageStatuses).filter(s => s.status === 'archive-pending').length;
  
  const archivedSites = sites.filter(site =>
    site.pages.length > 0 && site.pages.every(page => pageStatuses[page.url]?.status === 'archived')
  ).length;
  
  const archivePendingSites = sites.filter(site =>
    site.pages.some(page => pageStatuses[page.url]?.status === 'archive-pending') &&
    !site.pages.every(page => pageStatuses[page.url]?.status === 'archived')
  ).length;

  const isConfigured = isGoogleSheetsConfigured();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <span className="mt-3 text-gray-600">Loading from Google Sheets...</span>
        <span className="text-sm text-gray-400 mt-1">Syncing latest data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-3">
          📊 Status Check
        </h2>
        <p className="text-gray-600 mt-1">Track completion status for all sites and pages</p>
        
        {/* Sync Controls */}
        <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
          {/* Cloud Status Indicator */}
          <span className={`flex items-center gap-1 text-sm ${
            cloudStatus === 'connected' ? 'text-green-600' :
            cloudStatus === 'loading' ? 'text-blue-600' : 'text-gray-500'
          }`}>
            {cloudStatus === 'connected' ? (
              <><Cloud size={14} /> Connected</>
            ) : cloudStatus === 'loading' ? (
              <><Loader2 size={14} className="animate-spin" /> Syncing...</>
            ) : (
              <><CloudOff size={14} /> Offline</>
            )}
          </span>
          
          <span className="text-gray-300">|</span>
          
          <span className="text-sm text-gray-500">
            Last sync: {lastSyncTime}
          </span>
          
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          
          <button
            onClick={handleExportToSheet}
            disabled={exporting}
            className={`flex items-center gap-2 px-3 py-1 text-sm rounded-lg transition ${
              exportSuccess 
                ? 'bg-green-100 text-green-700' 
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
            } ${exporting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {exporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : exportSuccess ? (
              <Check size={14} />
            ) : (
              <Upload size={14} />
            )}
            {exporting ? 'Exporting...' : exportSuccess ? 'Exported!' : 'Export to Sheet'}
          </button>
          
          <a
            href="https://docs.google.com/spreadsheets/d/1ntgfO0PeVULOCA-Q1eLfoEJwW-izHlPpP1FvWvVk2UM/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
          >
            <ExternalLink size={14} />
            Open Sheet
          </a>
        </div>
        
        {/* Sync Status Messages */}
        {!isConfigured && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 max-w-2xl mx-auto">
            ⚠️ Google Sheets sync not configured. Add <code className="bg-yellow-100 px-1 rounded">NEXT_PUBLIC_GOOGLE_SCRIPT_URL</code> to Vercel Environment Variables
          </div>
        )}
        
        {cloudStatus === 'connected' && (
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 max-w-2xl mx-auto">
            ✅ Connected to Google Sheets - All users see the same data
          </div>
        )}
      </div>

      {/* Progress Overview - 4 STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sites Done */}
        <div className="bg-white rounded-lg border-2 border-blue-200 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-900">Sites Done</h3>
            <span className="text-2xl font-bold text-blue-600">{completedSites}/{sites.length}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${sites.length > 0 ? (completedSites / sites.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Pages Completed */}
        <div className="bg-white rounded-lg border-2 border-green-200 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-900">Pages Completed</h3>
            <span className="text-2xl font-bold text-green-600">{completedPages}/{totalPages}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-green-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${totalPages > 0 ? (completedPages / totalPages) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Sites to Archive */}
        <div className="bg-white rounded-lg border-2 border-indigo-200 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-900">Sites to Archive</h3>
            <span className="text-2xl font-bold text-indigo-600">{archivedSites}/{archivePendingSites}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
              style={{
                width: `${archivePendingSites > 0 ? (archivedSites / archivePendingSites) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Pages to Archive */}
        <div className="bg-white rounded-lg border-2 border-red-200 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-900">Pages to Archive</h3>
            <span className="text-2xl font-bold text-red-600">{archivedPages}/{archivePendingPages}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-red-600 h-3 rounded-full transition-all duration-500"
              style={{
                width: `${archivePendingPages > 0 ? (archivedPages / archivePendingPages) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Users size={18} />
            Team Members
          </h3>
          <button
            onClick={() => setShowAddMember(!showAddMember)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
          >
            <Plus size={14} />
            Add
          </button>
        </div>

        {showAddMember && (
          <div className="flex gap-2 mb-3 p-3 bg-gray-50 rounded-lg">
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Enter name..."
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && addTeamMember()}
            />
            <button onClick={addTeamMember} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Add</button>
            <button onClick={() => setShowAddMember(false)} className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-400">Cancel</button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {teamMembers.map((member, idx) => (
            <div 
              key={idx}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm group"
            >
              <span>{member.name}</span>
              <button
                onClick={() => removeTeamMember(member.name)}
                className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-red-600 transition"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sites List */}
      <div className="space-y-3">
        {sites.map(site => {
          const isExpanded = expandedSite === site.id;
          const completedInSite = site.pages.filter(p => pageStatuses[p.url]?.status === 'completed').length;
          const progress = site.pages.length > 0 ? (completedInSite / site.pages.length) * 100 : 0;

          return (
            <div key={site.id} className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => setExpandedSite(isExpanded ? null : site.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{site.title}</h3>
                    <p className="text-sm text-gray-600">{site.baseUrl}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-gray-600">
                        {completedInSite}/{site.pages.length} Pages
                      </span>
                      <div className="flex-1 max-w-xs bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t bg-gray-50 p-4">
                  <div className="space-y-2">
                    {site.pages.map((page, idx) => {
                      const status = pageStatuses[page.url] || { status: 'not-started', assignedTo: '', notes: '', updatedDate: '' };
                      const statusStyle = getStatusStyle(status.status);
                      const hasNotes = status.notes && status.notes.length > 0;
                      const latestScan = getLatestScanForPageLocal(page.url);
                      
                      return (
                        <div 
                          key={idx}
                          className={`p-3 rounded-lg border transition ${statusStyle.bgColor} border-opacity-50`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {getStatusIcon(status.status)}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate">{page.title}</div>
                                <div className="text-xs text-gray-500 truncate">{page.url}</div>
                                {status.status !== 'not-started' && status.assignedTo && (
                                  <div className={`text-xs mt-1 ${statusStyle.color}`}>
                                    {statusStyle.label} by {status.assignedTo}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openNotesPopup(page.url, page.title);
                                }}
                                className={`p-1.5 rounded hover:bg-white transition ${hasNotes ? 'text-purple-600' : 'text-gray-400'}`}
                                title={hasNotes ? 'View/Edit Notes' : 'Add Notes'}
                              >
                                <MessageSquare size={16} />
                              </button>

                              {latestScan && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openReportPopup(page.url, page.title);
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition"
                                  title="View latest scan report"
                                >
                                  <Eye size={12} />
                                  Report
                                </button>
                              )}
                              
                              <select
                                value={status.assignedTo}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateAssignedTo(page.url, e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs border rounded px-2 py-1.5 bg-white cursor-pointer hover:bg-gray-50 w-24 text-gray-900 font-medium"
                              >
                                <option value="" className="text-gray-900">Assign to</option>
                                {teamMembers.map((member, mIdx) => (
                                  <option key={mIdx} value={member.name} className="text-gray-900">{member.name}</option>
                                ))}
                              </select>

                              <select
                                value={status.status}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateStatus(page.url, e.target.value as PageStatusType);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs border rounded px-2 py-1.5 bg-white cursor-pointer hover:bg-gray-50 w-28 text-gray-900 font-medium"
                              >
                                {STATUS_OPTIONS.map(option => (
                                  <option key={option.value} value={option.value} className="text-gray-900">
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {hasNotes && (
                            <div className="mt-2 p-2 bg-white rounded text-xs text-gray-600 border">
                              <span className="font-medium">Notes:</span> {status.notes.substring(0, 100)}{status.notes.length > 100 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Notes Popup */}
      {notesPopup.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare size={20} />
                Notes
              </h3>
              <button
                onClick={() => setNotesPopup({ isOpen: false, pageUrl: '', pageTitle: '', notes: '' })}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-3 truncate">{notesPopup.pageTitle}</p>
              <textarea
                value={notesPopup.notes}
                onChange={(e) => setNotesPopup(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add notes about this page..."
                className="w-full h-32 p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setNotesPopup({ isOpen: false, pageUrl: '', pageTitle: '', notes: '' })}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => saveNotes(notesPopup.pageUrl, notesPopup.notes)}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                <Save size={16} />
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Popup */}
      {reportPopup.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-t-lg">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <FileText size={20} />
                  Scan Report
                </h3>
                <p className="text-purple-100 text-sm truncate max-w-md">{reportPopup.pageTitle}</p>
              </div>
              <button
                onClick={() => setReportPopup({ isOpen: false, pageUrl: '', pageTitle: '', scanData: null })}
                className="text-white hover:bg-purple-800 p-2 rounded"
              >
                <X size={20} />
              </button>
            </div>
            
            {reportPopup.scanData ? (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
                  <span>Scanned: {new Date(reportPopup.scanData.date).toLocaleString()}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    reportPopup.scanData.source === 'auto' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {reportPopup.scanData.source === 'auto' ? '🤖 Auto Scan' : '👤 Manual Scan'}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Performance', value: reportPopup.scanData.lighthousePerformance, bg: 'bg-orange-50', border: 'border-orange-200' },
                    { label: 'Accessibility', value: reportPopup.scanData.lighthouseAccessibility, bg: 'bg-blue-50', border: 'border-blue-200' },
                    { label: 'Best Practices', value: reportPopup.scanData.lighthouseBestPractices, bg: 'bg-green-50', border: 'border-green-200' },
                    { label: 'SEO', value: reportPopup.scanData.lighthouseSeo, bg: 'bg-purple-50', border: 'border-purple-200' },
                  ].map((metric, idx) => (
                    <div key={idx} className={`${metric.bg} p-4 rounded-lg border ${metric.border}`}>
                      <div className="text-sm text-gray-600 mb-1">{metric.label}</div>
                      <div className={`text-3xl font-bold ${
                        metric.value >= 90 ? 'text-green-600' :
                        metric.value >= 50 ? 'text-orange-600' : 'text-red-600'
                      }`}>
                        {metric.value || '-'}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Accessibility Issues</h4>
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      { label: 'Total', value: reportPopup.scanData.totalIssues, color: 'text-gray-900' },
                      { label: 'Critical', value: reportPopup.scanData.criticalCount, color: 'text-red-600' },
                      { label: 'Serious', value: reportPopup.scanData.seriousCount, color: 'text-orange-600' },
                      { label: 'Moderate', value: reportPopup.scanData.moderateCount, color: 'text-yellow-600' },
                      { label: 'Minor', value: reportPopup.scanData.minorCount, color: 'text-blue-600' },
                    ].map((item, idx) => (
                      <div key={idx} className="text-center">
                        <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                        <div className="text-xs text-gray-600">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                <p>No scan data available for this page.</p>
              </div>
            )}
            
            <div className="flex justify-end p-4 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setReportPopup({ isOpen: false, pageUrl: '', pageTitle: '', scanData: null })}
                className="px-6 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Legend */}
      <div className="bg-white border rounded-lg p-4 text-sm">
        <h4 className="font-semibold text-gray-800 mb-2">Status Legend:</h4>
        <div className="flex flex-wrap gap-4">
          {STATUS_OPTIONS.map(option => (
            <div key={option.value} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${option.bgColor} border`}></div>
              <span className="text-gray-900 font-medium">{option.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}