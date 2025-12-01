'use client';

import { useState, useEffect, useMemo } from 'react';
import { Site, fetchSites } from './DataService';
import PreScannedDataModal from './PreScannedDataModal';
import { 
  loadPreScannedData, 
  filterResultsByUrls, 
  checkDataAvailability,
  PageScanResult,
  ScanMetadata
} from './LatestDataService';
import { ChevronDown, ChevronUp, Check, Database, Zap, Search } from 'lucide-react';

interface SiteSelectorProps {
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
}: SiteSelectorProps) {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [expandedSites, setExpandedSites] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pre-scanned data state
  const [hasPreScannedData, setHasPreScannedData] = useState(false);
  const [preScannedMetadata, setPreScannedMetadata] = useState<ScanMetadata | null>(null);
  const [preScannedResults, setPreScannedResults] = useState<PageScanResult[]>([]);
  const [showPreScannedModal, setShowPreScannedModal] = useState(false);
  const [filteredResults, setFilteredResults] = useState<PageScanResult[]>([]);
  const [missingPages, setMissingPages] = useState<string[]>([]);
  
  // Lighthouse scan state
  const [isLighthouseRunning, setIsLighthouseRunning] = useState(false);
  const [lighthouseMessage, setLighthouseMessage] = useState('');

  useEffect(() => {
    async function loadSites() {
      setLoading(true);
      const fetchedSites = await fetchSites();
      setSites(fetchedSites);
      setLoading(false);
    }
    loadSites();
    loadPreScannedDataCheck();
  }, []);

  async function loadPreScannedDataCheck() {
    const data = await loadPreScannedData();
    if (data) {
      setHasPreScannedData(true);
      setPreScannedMetadata(data.metadata);
      setPreScannedResults(data.results);
    }
  }

  // Filter sites based on search
  const filteredSites = useMemo(() => {
    if (!searchQuery.trim()) return sites;
    const query = searchQuery.toLowerCase();
    return sites.filter(site => 
      site.title.toLowerCase().includes(query) ||
      site.baseUrl.toLowerCase().includes(query) ||
      site.pages.some(page => 
        page.title.toLowerCase().includes(query) ||
        page.url.toLowerCase().includes(query)
      )
    );
  }, [sites, searchQuery]);

  const toggleSite = (siteId: string) => {
    setExpandedSites(prev =>
      prev.includes(siteId)
        ? prev.filter(id => id !== siteId)
        : [...prev, siteId]
    );
  };

  const selectSite = (siteId: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;

    if (selectedSites.includes(siteId)) {
      setSelectedSites(prev => prev.filter(id => id !== siteId));
      setSelectedPages(prev => {
        const next = { ...prev };
        delete next[siteId];
        return next;
      });
    } else {
      setSelectedSites(prev => [...prev, siteId]);
      setSelectedPages(prev => ({
        ...prev,
        [siteId]: site.pages.map(p => p.url),
      }));
    }
  };

  const togglePage = (siteId: string, pageUrl: string) => {
    setSelectedPages(prev => {
      const currentPages = prev[siteId] || [];
      if (currentPages.includes(pageUrl)) {
        const newPages = currentPages.filter(url => url !== pageUrl);
        if (newPages.length === 0) {
          setSelectedSites(s => s.filter(id => id !== siteId));
          const next = { ...prev };
          delete next[siteId];
          return next;
        }
        return { ...prev, [siteId]: newPages };
      } else {
        if (!selectedSites.includes(siteId)) {
          setSelectedSites(s => [...s, siteId]);
        }
        return { ...prev, [siteId]: [...currentPages, pageUrl] };
      }
    });
  };

  const selectAll = () => {
    const allSiteIds = filteredSites.map(s => s.id);
    setSelectedSites(allSiteIds);
    const allPages: Record<string, string[]> = {};
    filteredSites.forEach(site => {
      allPages[site.id] = site.pages.map(p => p.url);
    });
    setSelectedPages(allPages);
  };

  const deselectAll = () => {
    setSelectedSites([]);
    setSelectedPages({});
  };

  const getTotalSelectedPages = () => {
    return Object.values(selectedPages).reduce((sum, pages) => sum + pages.length, 0);
  };

  const getSelectedSitesWithPages = (): Site[] => {
    return selectedSites.map(siteId => {
      const site = sites.find(s => s.id === siteId);
      if (!site) return null;
      return {
        ...site,
        pages: site.pages.filter(page => selectedPages[siteId]?.includes(page.url)),
      };
    }).filter((s): s is Site => s !== null);
  };

  // Handle Real Scan (n8n + Playwright + axe-core)
  const handleRunRealScan = () => {
    const sitesWithPages = getSelectedSitesWithPages();
    const pageCount = getTotalSelectedPages();
    
    if (pageCount === 0) {
      alert('Please select at least one page to scan');
      return;
    }
    
    onRealScan(sitesWithPages, pageCount);
  };

  // Handle Lighthouse Scan (Google PageSpeed API) - Opens in NEW TAB
  const handleRunLighthouseScan = async () => {
    const sitesWithPages = getSelectedSitesWithPages();
    const pageCount = getTotalSelectedPages();
    
    if (pageCount === 0) {
      alert('Please select at least one page to scan');
      return;
    }

    setIsLighthouseRunning(true);
    setLighthouseMessage(`🔍 Starting Lighthouse scan for ${pageCount} pages...`);

    try {
      const results: Array<{
        url: string;
        title: string;
        score: number;
        issues: any[];
        summary: { critical: number; serious: number; moderate: number; minor: number; total: number; passed: number };
        timestamp: string;
      }> = [];

      let completedPages = 0;
      const totalPages = pageCount;

      for (const site of sitesWithPages) {
        for (const page of site.pages) {
          setLighthouseMessage(`🔍 Scanning ${page.title}... (${completedPages + 1}/${totalPages})`);

          try {
            const response = await fetch('/api/lighthouse', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: page.url }),
            });

            if (response.ok) {
              const data = await response.json();
              
              results.push({
                url: page.url,
                title: page.title,
                score: data.scores?.accessibility || 0,
                issues: data.accessibilityIssues || [],
                summary: data.summary || { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0, passed: 0 },
                timestamp: new Date().toISOString(),
              });

              console.log(`✅ Lighthouse: ${page.title} - Score: ${data.scores?.accessibility || 0}`);
            } else {
              console.error(`❌ Lighthouse failed for ${page.url}`);
              results.push({
                url: page.url,
                title: page.title,
                score: 0,
                issues: [],
                summary: { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0, passed: 0 },
                timestamp: new Date().toISOString(),
              });
            }
          } catch (error) {
            console.error(`❌ Lighthouse error for ${page.url}:`, error);
            results.push({
              url: page.url,
              title: page.title,
              score: 0,
              issues: [],
              summary: { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0, passed: 0 },
              timestamp: new Date().toISOString(),
            });
          }

          completedPages++;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Calculate totals
      const avgScore = results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
        : 0;
      const totalIssues = results.reduce((sum, r) => sum + r.summary.total, 0);

      // Save to sessionStorage for the new page
      const lighthouseResults = {
        pages: results,
        totalPages: results.length,
        avgScore,
        totalIssues,
        timestamp: new Date().toISOString(),
      };

      sessionStorage.setItem('lighthouseResults', JSON.stringify(lighthouseResults));

      setLighthouseMessage(`✅ Lighthouse scan complete! Opening results...`);

      // Open in new tab
      window.open('/lighthouse-results', '_blank');

      setTimeout(() => {
        setLighthouseMessage('');
      }, 3000);

    } catch (error) {
      console.error('❌ Lighthouse scan failed:', error);
      setLighthouseMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLighthouseRunning(false);
    }
  };

  // Handle view pre-scanned data
  const handleViewPreScannedData = () => {
    const allSelectedUrls = Object.values(selectedPages).flat();
    
    if (allSelectedUrls.length === 0) {
      setFilteredResults(preScannedResults);
      setMissingPages([]);
    } else {
      const { available, missing } = checkDataAvailability(preScannedResults, allSelectedUrls);
      const filtered = filterResultsByUrls(preScannedResults, available);
      setFilteredResults(filtered);
      setMissingPages(missing);
    }
    
    setShowPreScannedModal(true);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading sites...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">Select Pages to Audit</h2>
            <p className="text-blue-100 mt-1">
              {getTotalSelectedPages()} of {sites.reduce((sum, s) => sum + s.pages.length, 0)} pages selected
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition"
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition"
            >
              Deselect All
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 bg-gray-50 border-b space-y-3">
        {/* Real Scan Status Message */}
        {realScanMessage && (
          <div className={`p-3 rounded-lg text-sm font-medium ${
            realScanMessage.includes('❌') ? 'bg-red-100 text-red-800' :
            realScanMessage.includes('✅') ? 'bg-green-100 text-green-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {realScanMessage}
          </div>
        )}

        {/* Lighthouse Status Message */}
        {lighthouseMessage && (
          <div className={`p-3 rounded-lg text-sm font-medium ${
            lighthouseMessage.includes('❌') ? 'bg-red-100 text-red-800' :
            lighthouseMessage.includes('✅') ? 'bg-green-100 text-green-800' :
            'bg-purple-100 text-purple-800'
          }`}>
            {lighthouseMessage}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {/* Real Scan Button (n8n + axe-core) */}
          <button
            onClick={handleRunRealScan}
            disabled={getTotalSelectedPages() === 0 || isRealScanRunning || isLighthouseRunning}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${
              getTotalSelectedPages() === 0 || isRealScanRunning || isLighthouseRunning
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isRealScanRunning ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Scanning...
              </>
            ) : (
              <>
                <Zap size={20} />
                Real Scan ({getTotalSelectedPages()})
              </>
            )}
          </button>

          {/* Lighthouse Score Button (Google PageSpeed API) */}
          <button
            onClick={handleRunLighthouseScan}
            disabled={getTotalSelectedPages() === 0 || isRealScanRunning || isLighthouseRunning}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${
              getTotalSelectedPages() === 0 || isRealScanRunning || isLighthouseRunning
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {isLighthouseRunning ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Running Lighthouse...
              </>
            ) : (
              <>
                <Search size={20} />
                Lighthouse Score ({getTotalSelectedPages()})
              </>
            )}
          </button>

          {/* Pre-Scanned Data Button */}
          {hasPreScannedData && (
            <button
              onClick={handleViewPreScannedData}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition"
            >
              <Database size={20} />
              View Latest Data
            </button>
          )}
        </div>

        {/* Info about scans */}
        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>Real Scan:</strong> Uses n8n + Playwright + axe-core for detailed accessibility issues (requires n8n running locally)</p>
          <p><strong>Lighthouse Score:</strong> Uses Google PageSpeed Insights API for accessibility scores (works on Vercel)</p>
        </div>
      </div>

      {/* Pre-scanned data info */}
      {hasPreScannedData && preScannedMetadata && (
        <div className="px-4 py-2 bg-purple-50 border-b text-sm text-purple-700">
          <Database size={16} className="inline mr-2" />
          Latest scan data available from: {new Date(preScannedMetadata.scanDate).toLocaleString()}
        </div>
      )}

      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search sites or pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Sites List */}
      <div className="max-h-[500px] overflow-y-auto">
        {filteredSites.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchQuery ? 'No sites match your search' : 'No sites available'}
          </div>
        ) : (
          filteredSites.map(site => (
            <div key={site.id} className="border-b last:border-b-0">
              {/* Site Header */}
              <div
                className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition ${
                  selectedSites.includes(site.id) ? 'bg-blue-50' : ''
                }`}
              >
                <button
                  onClick={() => selectSite(site.id)}
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center transition ${
                    selectedSites.includes(site.id)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {selectedSites.includes(site.id) && <Check size={16} />}
                </button>
                
                <div className="flex-1 min-w-0" onClick={() => toggleSite(site.id)}>
                  <h3 className="font-semibold text-gray-900 truncate">{site.title}</h3>
                  <p className="text-sm text-gray-500 truncate">{site.baseUrl} • {site.pages.length} pages</p>
                </div>

                <button
                  onClick={() => toggleSite(site.id)}
                  className="p-2 hover:bg-gray-200 rounded transition"
                >
                  {expandedSites.includes(site.id) ? (
                    <ChevronUp size={20} className="text-gray-500" />
                  ) : (
                    <ChevronDown size={20} className="text-gray-500" />
                  )}
                </button>
              </div>

              {/* Pages List */}
              {expandedSites.includes(site.id) && (
                <div className="bg-gray-50 border-t">
                  {site.pages.map(page => (
                    <div
                      key={page.url}
                      onClick={() => togglePage(site.id, page.url)}
                      className={`flex items-center gap-3 px-4 py-2 pl-12 cursor-pointer hover:bg-gray-100 transition ${
                        selectedPages[site.id]?.includes(page.url) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                          selectedPages[site.id]?.includes(page.url)
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedPages[site.id]?.includes(page.url) && <Check size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{page.title}</p>
                        <p className="text-xs text-gray-500 truncate">{page.url}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pre-Scanned Data Modal */}
      {showPreScannedModal && (
        <PreScannedDataModal
          isOpen={showPreScannedModal}
          onClose={() => setShowPreScannedModal(false)}
          metadata={preScannedMetadata}
          results={filteredResults.length > 0 ? filteredResults : preScannedResults}
          missingPages={missingPages}
          totalScannedInData={preScannedResults.length}
        />
      )}
    </div>
  );
}