// app/components/SiteSelector.tsx
// Updated to add "View Latest Data" button while keeping existing interface

'use client';

import { useState, useEffect } from 'react';
import { Site, fetchSites } from './DataService';
import { 
  ChevronDown, 
  ChevronUp, 
  CheckSquare, 
  Square, 
  Gauge, 
  Rocket,
  Database,
  AlertCircle,
  Loader2,
  Calendar
} from 'lucide-react';
import { hasScanData, getLastScanDate } from './LatestDataService';
import LatestDataModal from './LatestDataModal';

interface Props {
  onSelectSites: (sites: Site[], pageCount: number) => void;
  onRealScan: (sites: Site[], pageCount: number) => void;
  isRealScanRunning: boolean;
  realScanMessage: string;
}

export default function SiteSelector({ 
  onSelectSites, 
  onRealScan,
  isRealScanRunning,
  realScanMessage
}: Props) {
  const [sites, setSites] = useState<Site[]>([]);
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [selectedPages, setSelectedPages] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);
  
  // View Latest Data state
  const [hasLatestData, setHasLatestData] = useState<boolean>(false);
  const [lastScanDate, setLastScanDate] = useState<string | null>(null);
  const [checkingData, setCheckingData] = useState<boolean>(true);
  const [showLatestDataModal, setShowLatestDataModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const fetchedSites = await fetchSites();
      setSites(fetchedSites);
      setLoading(false);
    }
    loadData();
  }, []);

  // Check if scan data exists
  useEffect(() => {
    async function checkData() {
      setCheckingData(true);
      try {
        const exists = await hasScanData();
        setHasLatestData(exists);
        
        if (exists) {
          const date = await getLastScanDate();
          setLastScanDate(date);
        }
      } catch (error) {
        console.error('Error checking scan data:', error);
        setHasLatestData(false);
      } finally {
        setCheckingData(false);
      }
    }
    
    checkData();
  }, []);

  const toggleSite = (siteId: string) => {
    const newExpanded = new Set(expandedSites);
    if (newExpanded.has(siteId)) {
      newExpanded.delete(siteId);
    } else {
      newExpanded.add(siteId);
    }
    setExpandedSites(newExpanded);
  };

  const togglePage = (siteId: string, pageUrl: string) => {
    const newSelected = new Map(selectedPages);
    const sitePages = newSelected.get(siteId) || new Set();
    
    if (sitePages.has(pageUrl)) {
      sitePages.delete(pageUrl);
    } else {
      sitePages.add(pageUrl);
    }
    
    newSelected.set(siteId, sitePages);
    setSelectedPages(newSelected);
  };

  const toggleAllPagesInSite = (site: Site) => {
    const newSelected = new Map(selectedPages);
    const sitePages = newSelected.get(site.id) || new Set();
    
    if (sitePages.size === site.pages.length) {
      newSelected.set(site.id, new Set());
    } else {
      newSelected.set(site.id, new Set(site.pages.map(p => p.url)));
    }
    
    setSelectedPages(newSelected);
  };

  const selectAll = () => {
    const newSelected = new Map<string, Set<string>>();
    sites.forEach(site => {
      newSelected.set(site.id, new Set(site.pages.map(p => p.url)));
    });
    setSelectedPages(newSelected);
  };

  const deselectAll = () => {
    setSelectedPages(new Map());
  };

  const getSelectedCount = () => {
    let count = 0;
    selectedPages.forEach(pages => {
      count += pages.size;
    });
    return count;
  };

  const getSelectedSites = (): Site[] => {
    const result: Site[] = [];
    
    sites.forEach(site => {
      const selectedPageUrls = selectedPages.get(site.id);
      if (selectedPageUrls && selectedPageUrls.size > 0) {
        const filteredSite: Site = {
          ...site,
          pages: site.pages.filter(p => selectedPageUrls.has(p.url))
        };
        result.push(filteredSite);
      }
    });
    
    return result;
  };

  const getSelectedDataWithDetails = () => {
    const result: { siteId: string; siteBaseUrl: string; pages: { url: string; title: string }[] }[] = [];
    
    sites.forEach(site => {
      const selectedPageUrls = selectedPages.get(site.id);
      if (selectedPageUrls && selectedPageUrls.size > 0) {
        const pages = site.pages
          .filter(p => selectedPageUrls.has(p.url))
          .map(p => ({ url: p.url, title: p.title }));
        
        result.push({ 
          siteId: site.id, 
          siteBaseUrl: site.baseUrl,
          pages 
        });
      }
    });
    
    return result;
  };

  const handleRunLighthouse = () => {
    const selectedSites = getSelectedSites();
    const pageCount = getSelectedCount();
    onSelectSites(selectedSites, pageCount);
  };

  const handleRunRealScan = () => {
    const selectedSites = getSelectedSites();
    const pageCount = getSelectedCount();
    onRealScan(selectedSites, pageCount);
  };

  const handleViewLatestData = () => {
    setShowLatestDataModal(true);
  };

  const selectedCount = getSelectedCount();
  const totalPages = sites.reduce((sum, site) => sum + site.pages.length, 0);

  const formatLastScan = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <span className="ml-3 text-gray-600">Loading sites...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Select Pages to Audit</h2>
          <p className="text-gray-600">
            {selectedCount} of {totalPages} pages selected
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Real Scan Status Message */}
      {realScanMessage && (
        <div className={`p-4 rounded-lg ${
          realScanMessage.includes('❌') ? 'bg-red-50 border border-red-200' :
          realScanMessage.includes('✅') ? 'bg-green-50 border border-green-200' :
          'bg-blue-50 border border-blue-200'
        }`}>
          <p className={`font-medium ${
            realScanMessage.includes('❌') ? 'text-red-800' :
            realScanMessage.includes('✅') ? 'text-green-800' :
            'text-blue-800'
          }`}>
            {realScanMessage}
          </p>
        </div>
      )}

      {/* Last Scan Info */}
      {!checkingData && hasLatestData && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
          <Calendar size={16} className="text-green-600" />
          <span className="text-green-800">
            Latest scan data available from: <strong>{formatLastScan(lastScanDate)}</strong>
          </span>
        </div>
      )}

      {/* Sites List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {sites.map(site => {
          const isExpanded = expandedSites.has(site.id);
          const siteSelectedPages = selectedPages.get(site.id) || new Set();
          const allSelected = siteSelectedPages.size === site.pages.length && site.pages.length > 0;
          const someSelected = siteSelectedPages.size > 0 && !allSelected;

          return (
            <div key={site.id} className="border rounded-lg overflow-hidden bg-white">
              <div className="flex items-center p-3 bg-gray-50 hover:bg-gray-100 transition">
                <button
                  onClick={() => toggleAllPagesInSite(site)}
                  className="mr-3 text-blue-600 hover:text-blue-800"
                >
                  {allSelected ? (
                    <CheckSquare size={20} />
                  ) : someSelected ? (
                    <div className="relative">
                      <Square size={20} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-blue-600 rounded-sm"></div>
                      </div>
                    </div>
                  ) : (
                    <Square size={20} />
                  )}
                </button>
                
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => toggleSite(site.id)}
                >
                  <div className="font-medium text-gray-900">{site.title}</div>
                  <div className="text-sm text-gray-600">
                    {site.baseUrl} • {site.pages.length} pages
                    {siteSelectedPages.size > 0 && (
                      <span className="text-blue-600 ml-2">
                        ({siteSelectedPages.size} selected)
                      </span>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => toggleSite(site.id)}
                  className="p-1 text-gray-500 hover:text-gray-700"
                >
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>

              {isExpanded && (
                <div className="border-t divide-y max-h-[300px] overflow-y-auto">
                  {site.pages.map((page, idx) => {
                    const isSelected = siteSelectedPages.has(page.url);
                    
                    return (
                      <div
                        key={idx}
                        onClick={() => togglePage(site.id, page.url)}
                        className={`flex items-center p-3 cursor-pointer transition ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="mr-3 text-blue-600">
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 truncate">{page.title}</div>
                          <div className="text-xs text-gray-500 truncate">{page.url}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Warning for large selection */}
      {selectedCount > 50 && (
        <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
          <AlertCircle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-yellow-800">
            <strong>Large selection:</strong> You've selected {selectedCount} pages. 
            Real Scan may take a long time. Consider using "View Latest Data" instead.
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          {/* Lighthouse Score */}
          <button
            onClick={handleRunLighthouse}
            disabled={selectedCount === 0 || isRealScanRunning}
            className={`flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition ${
              selectedCount === 0 || isRealScanRunning
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Gauge size={20} />
            <div className="text-left">
              <div>Lighthouse Score</div>
              <div className="text-xs font-normal opacity-75">Performance metrics</div>
            </div>
          </button>

          {/* Real Scan */}
          <button
            onClick={handleRunRealScan}
            disabled={selectedCount === 0 || isRealScanRunning}
            className={`flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition ${
              selectedCount === 0 || isRealScanRunning
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isRealScanRunning ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Rocket size={20} />
            )}
            <div className="text-left">
              <div>{isRealScanRunning ? 'Scanning...' : 'Real Scan'}</div>
              <div className="text-xs font-normal opacity-75">
                {isRealScanRunning ? 'Please wait' : 'Requires n8n (local)'}
              </div>
            </div>
          </button>

          {/* View Latest Data - NEW */}
          <button
            onClick={handleViewLatestData}
            disabled={selectedCount === 0 || isRealScanRunning || checkingData}
            className={`flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition ${
              selectedCount === 0 || isRealScanRunning || checkingData
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : hasLatestData
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
            }`}
          >
            {checkingData ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Database size={20} />
            )}
            <div className="text-left">
              <div>{checkingData ? 'Checking...' : 'View Latest Data'}</div>
              <div className="text-xs font-normal opacity-75">
                {checkingData 
                  ? 'Please wait' 
                  : hasLatestData 
                    ? 'Pre-scanned results' 
                    : 'No data yet'
                }
              </div>
            </div>
          </button>
        </div>

        {/* Help Text */}
        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <strong className="text-gray-700">Lighthouse Score:</strong>
              <br />Performance, SEO metrics
            </div>
            <div>
              <strong className="text-gray-700">Real Scan:</strong>
              <br />Full a11y scan (needs n8n locally)
            </div>
            <div>
              <strong className="text-gray-700">View Latest Data:</strong>
              <br />Pre-scanned results (works for everyone)
            </div>
          </div>
        </div>
      </div>

      {/* Latest Data Modal */}
      <LatestDataModal
        isOpen={showLatestDataModal}
        onClose={() => setShowLatestDataModal(false)}
        selectedPages={getSelectedDataWithDetails()}
      />
    </div>
  );
}