// app/components/SiteSelector.tsx

'use client';

import { useState, useEffect } from 'react';
import { fetchSites, Site } from './DataService';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface Props {
  onSelectSites: (sites: Site[], pageCount: number) => void;
}

interface SelectedPages {
  [siteId: string]: Set<string>;
}

export default function SiteSelector({ onSelectSites }: Props) {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedPages, setSelectedPages] = useState<SelectedPages>({});
  const [expandedSite, setExpandedSite] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadSites();
  }, []);

  async function loadSites() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSites();
      setSites(data);
      if (data.length === 0) {
        setError('No sites found. Please try again later.');
      }
    } catch (err) {
      setError('Failed to load sites. Please check your connection.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function togglePage(siteId: string, pageUrl: string) {
    setSelectedPages(prev => {
      const sitePagesSet = new Set(prev[siteId] || []);
      if (sitePagesSet.has(pageUrl)) {
        sitePagesSet.delete(pageUrl);
      } else {
        sitePagesSet.add(pageUrl);
      }
      const updated = { ...prev };
      if (sitePagesSet.size === 0) {
        delete updated[siteId];
      } else {
        updated[siteId] = sitePagesSet;
      }
      updatePageCount(updated);
      return updated;
    });
  }

  function toggleSitePages(siteId: string, allPages: string[]) {
    setSelectedPages(prev => {
      const sitePagesSet = new Set(prev[siteId] || []);
      const allPageUrls = new Set(allPages);
      
      // If all pages are selected, deselect all. Otherwise, select all.
      const shouldSelectAll = sitePagesSet.size !== allPageUrls.size;
      
      const updated = { ...prev };
      if (shouldSelectAll) {
        updated[siteId] = new Set(allPages);
      } else {
        delete updated[siteId];
      }
      updatePageCount(updated);
      return updated;
    });
  }

  function updatePageCount(pages: SelectedPages) {
    let count = 0;
    Object.values(pages).forEach(pageSet => {
      count += pageSet.size;
    });
    setTotalPages(count);
  }

  function handleSelectAllPages() {
    const newSelection: SelectedPages = {};
    sites.forEach(site => {
      newSelection[site.id] = new Set(site.pages.map(p => p.url));
    });
    setSelectedPages(newSelection);
    updatePageCount(newSelection);
  }

  function handleClearAll() {
    setSelectedPages({});
    setTotalPages(0);
  }

  function handleRunAudit() {
    if (totalPages === 0) {
      alert('Please select at least one page');
      return;
    }

    // Build selected sites with only selected pages
    const selectedSitesWithPages: Site[] = [];
    
    Object.entries(selectedPages).forEach(([siteId, pageUrls]) => {
      const site = sites.find(s => s.id === siteId);
      if (site) {
        const selectedPagesList = Array.from(pageUrls).map(url => 
          site.pages.find(p => p.url === url)
        ).filter(Boolean) as typeof site.pages;
        
        selectedSitesWithPages.push({
          ...site,
          pages: selectedPagesList
        });
      }
    });

    onSelectSites(selectedSitesWithPages, totalPages);
  }

  const filteredSites = sites.filter(site =>
    site.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.baseUrl.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-8 bg-white rounded-lg shadow-lg text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">Loading sites...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-3">
          <AlertCircle className="text-red-600" size={24} />
          <div>
            <h3 className="font-semibold text-red-900">Error Loading Sites</h3>
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={loadSites}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Pages to Audit</h2>
        <p className="text-gray-600 text-sm">Choose specific pages from each site for accessibility checks</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded border border-blue-200">
          <div className="text-2xl font-bold text-blue-600">{sites.length}</div>
          <div className="text-sm text-gray-600">Total Sites</div>
        </div>
        <div className="bg-green-50 p-4 rounded border border-green-200">
          <div className="text-2xl font-bold text-green-600">{Object.keys(selectedPages).length}</div>
          <div className="text-sm text-gray-600">Sites with Pages Selected</div>
        </div>
        <div className="bg-purple-50 p-4 rounded border border-purple-200">
          <div className="text-2xl font-bold text-purple-600">{totalPages}</div>
          <div className="text-sm text-gray-600">Pages Selected</div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search sites by name or URL..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={handleSelectAllPages}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition"
        >
          Select All Pages
        </button>
        <button
          onClick={handleClearAll}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition"
        >
          Clear All
        </button>
      </div>

      {/* Warning */}
      {totalPages > 50 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 font-semibold">
            ⚠️ Warning: You selected {totalPages} pages (max recommended: 50)
          </p>
          <p className="text-yellow-700 text-sm mt-1">
            Large audits may take 30+ minutes to complete
          </p>
        </div>
      )}

      {/* Sites List */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto border rounded-lg p-4 bg-gray-50 mb-6">
        {filteredSites.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? 'No sites match your search' : 'No sites available'}
          </div>
        ) : (
          filteredSites.map(site => {
            const sitePages = selectedPages[site.id] || new Set();
            const isSiteExpanded = expandedSite === site.id;
            const isSiteSelected = sitePages.size > 0;
            const allPagesSelected = sitePages.size === site.pages.length;

            return (
              <div key={site.id} className="border rounded-lg bg-white overflow-hidden hover:shadow-md transition">
                {/* Site Header */}
                <div
                  className="flex items-center gap-3 p-4 hover:bg-blue-50 cursor-pointer transition"
                  onClick={() => setExpandedSite(isSiteExpanded ? null : site.id)}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <div className="text-sm font-semibold text-gray-600">
                      {sitePages.size}/{site.pages.length}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{site.title}</div>
                      <div className="text-xs text-gray-600">{site.baseUrl}</div>
                    </div>
                  </div>
                  {isSiteExpanded ? (
                    <ChevronUp size={24} className="text-gray-600" />
                  ) : (
                    <ChevronDown size={24} className="text-gray-600" />
                  )}
                </div>

                {/* Pages List */}
                {isSiteExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="mb-3 flex gap-2">
                      <button
                        onClick={() => toggleSitePages(site.id, site.pages.map(p => p.url))}
                        className={`px-3 py-1 rounded text-sm font-semibold transition ${
                          allPagesSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                        }`}
                      >
                        {allPagesSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {site.pages.map((page, idx) => {
                        const isPageSelected = sitePages.has(page.url);
                        return (
                          <label
                            key={idx}
                            className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer transition"
                          >
                            <input
                              type="checkbox"
                              checked={isPageSelected}
                              onChange={() => togglePage(site.id, page.url)}
                              className="w-4 h-4 cursor-pointer accent-blue-600"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-900 truncate">
                                {page.title || page.path}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {page.url}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Run Button */}
      <button
        onClick={handleRunAudit}
        disabled={totalPages === 0}
        className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition text-lg ${
          totalPages === 0
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-md'
        }`}
      >
        🚀 Run Audit on {totalPages} Page{totalPages !== 1 ? 's' : ''}
      </button>
    </div>
  );
}