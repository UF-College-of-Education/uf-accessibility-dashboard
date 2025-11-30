// app/components/LatestDataModal.tsx
// UPDATED: Removed fake Lighthouse scores display
// Shows only real issue counts from axe-core scans
// For real Lighthouse accessibility scores, use the "Lighthouse Score" button

'use client';

import React, { useState, useEffect } from 'react';
import { 
  loadPreScannedData, 
  PageScanResult, 
  ScanMetadata,
  ScanIssue 
} from './LatestDataService';

interface LatestDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LatestDataModal({ isOpen, onClose }: LatestDataModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ScanMetadata | null>(null);
  const [results, setResults] = useState<PageScanResult[]>([]);
  const [selectedPage, setSelectedPage] = useState<PageScanResult | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  
  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await loadPreScannedData();
      
      if (!data) {
        setError('No scan data found. Run a scan first using the "Save to GitHub" feature.');
        return;
      }
      
      setMetadata(data.metadata);
      setResults(data.results);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load scan data');
    } finally {
      setLoading(false);
    }
  };

  const toggleIssue = (issueId: string) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'serious': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'minor': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getImpactEmoji = (impact: string) => {
    switch (impact) {
      case 'critical': return '🔴';
      case 'serious': return '🟠';
      case 'moderate': return '🟡';
      case 'minor': return '🔵';
      default: return '⚪';
    }
  };

  // Filter results
  const filteredResults = results.filter(page => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!page.url.toLowerCase().includes(query) && 
          !page.title?.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });

  // Filter issues for selected page
  const getFilteredIssues = (issues: ScanIssue[]) => {
    return issues.filter(issue => {
      if (severityFilter !== 'all' && issue.impact !== severityFilter) {
        return false;
      }
      return true;
    });
  };

  // Calculate totals
  const totalIssues = results.reduce((sum, r) => {
    return sum + (r.summary?.critical || 0) + (r.summary?.serious || 0) + 
           (r.summary?.moderate || 0) + (r.summary?.minor || 0);
  }, 0);

  const totalCritical = results.reduce((sum, r) => sum + (r.summary?.critical || 0), 0);
  const totalSerious = results.reduce((sum, r) => sum + (r.summary?.serious || 0), 0);
  const totalModerate = results.reduce((sum, r) => sum + (r.summary?.moderate || 0), 0);
  const totalMinor = results.reduce((sum, r) => sum + (r.summary?.minor || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                📊 Pre-Scanned Data (axe-core)
              </h2>
              <p className="text-purple-100 mt-1">
                Issue counts from automated accessibility scans
              </p>
              <p className="text-purple-200 text-sm mt-1">
                💡 For real Lighthouse scores, use the "Lighthouse Score" button
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl font-bold"
            >
              ×
            </button>
          </div>
          
          {metadata && (
            <div className="mt-4 flex gap-6 text-sm">
              <span>📅 {new Date(metadata.scanDate).toLocaleDateString()}</span>
              <span>📄 {metadata.totalPages} pages</span>
              <span>⚠️ {totalIssues} total issues</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-600">Loading scan data...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-600">{error}</p>
            </div>
          ) : selectedPage ? (
            // Single Page View
            <div>
              <button 
                onClick={() => setSelectedPage(null)}
                className="mb-4 text-purple-600 hover:text-purple-800 flex items-center gap-1"
              >
                ← Back to all pages
              </button>
              
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-lg truncate">{selectedPage.title || 'Untitled'}</h3>
                <a 
                  href={selectedPage.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline text-sm truncate block"
                >
                  {selectedPage.url}
                </a>
                
                {/* Issue Summary */}
                <div className="mt-4 grid grid-cols-4 gap-3">
                  <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
                    <div className="text-2xl font-bold text-red-600">{selectedPage.summary?.critical || 0}</div>
                    <div className="text-xs text-red-600">Critical</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-100">
                    <div className="text-2xl font-bold text-orange-600">{selectedPage.summary?.serious || 0}</div>
                    <div className="text-xs text-orange-600">Serious</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-100">
                    <div className="text-2xl font-bold text-yellow-600">{selectedPage.summary?.moderate || 0}</div>
                    <div className="text-xs text-yellow-600">Moderate</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                    <div className="text-2xl font-bold text-blue-600">{selectedPage.summary?.minor || 0}</div>
                    <div className="text-xs text-blue-600">Minor</div>
                  </div>
                </div>
              </div>
              
              {/* Severity Filter */}
              <div className="mb-4">
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">🔴 Critical</option>
                  <option value="serious">🟠 Serious</option>
                  <option value="moderate">🟡 Moderate</option>
                  <option value="minor">🔵 Minor</option>
                </select>
              </div>
              
              {/* Issues List */}
              <div className="space-y-3">
                {getFilteredIssues(selectedPage.issues || []).map((issue, idx) => (
                  <div 
                    key={`${issue.id}-${idx}`}
                    className="border rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => toggleIssue(`${issue.id}-${idx}`)}
                      className="w-full p-4 text-left hover:bg-gray-50 flex items-start gap-3"
                    >
                      <span className="text-lg">{getImpactEmoji(issue.impact)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{issue.help || issue.id}</div>
                        <div className="text-sm text-gray-500 truncate">{issue.description}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getImpactColor(issue.impact)}`}>
                        {issue.impact}
                      </span>
                      <span className="text-gray-400">
                        {expandedIssues.has(`${issue.id}-${idx}`) ? '▼' : '▶'}
                      </span>
                    </button>
                    
                    {expandedIssues.has(`${issue.id}-${idx}`) && (
                      <div className="border-t bg-gray-50 p-4">
                        <div className="mb-3">
                          <span className="text-xs font-medium text-gray-500">Rule ID:</span>
                          <code className="ml-2 px-2 py-1 bg-gray-200 rounded text-sm">{issue.id}</code>
                        </div>
                        
                        {issue.helpUrl && (
                          <a 
                            href={issue.helpUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:underline text-sm block mb-3"
                          >
                            📚 Learn more about this issue →
                          </a>
                        )}
                        
                        {issue.nodes && issue.nodes.length > 0 && (
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-2">
                              Affected Elements ({issue.nodes.length}):
                            </div>
                            <div className="space-y-2 max-h-60 overflow-auto">
                              {issue.nodes.slice(0, 5).map((node, nodeIdx) => (
                                <div key={nodeIdx} className="bg-white border rounded-lg p-3 text-sm">
                                  {node.target && (
                                    <div className="mb-1">
                                      <span className="text-gray-500">📍 Selector:</span>
                                      <code className="ml-2 text-purple-600 text-xs break-all">
                                        {Array.isArray(node.target) ? node.target.join(' > ') : node.target}
                                      </code>
                                    </div>
                                  )}
                                  {node.html && (
                                    <div className="mb-1">
                                      <span className="text-gray-500">💻 HTML:</span>
                                      <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                                        {node.html.substring(0, 200)}{node.html.length > 200 ? '...' : ''}
                                      </pre>
                                    </div>
                                  )}
                                  {node.failureSummary && (
                                    <div>
                                      <span className="text-gray-500">⚠️ Problem:</span>
                                      <p className="mt-1 text-gray-700 text-xs">{node.failureSummary}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {issue.nodes.length > 5 && (
                                <p className="text-gray-500 text-sm text-center py-2">
                                  ... and {issue.nodes.length - 5} more elements
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
                {getFilteredIssues(selectedPage.issues || []).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No issues match the current filter
                  </div>
                )}
              </div>
            </div>
          ) : (
            // All Pages View
            <div>
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100">
                  <div className="text-3xl font-bold text-red-600">{totalCritical}</div>
                  <div className="text-sm text-red-600">Critical</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 text-center border border-orange-100">
                  <div className="text-3xl font-bold text-orange-600">{totalSerious}</div>
                  <div className="text-sm text-orange-600">Serious</div>
                </div>
                <div className="bg-yellow-50 rounded-xl p-4 text-center border border-yellow-100">
                  <div className="text-3xl font-bold text-yellow-600">{totalModerate}</div>
                  <div className="text-sm text-yellow-600">Moderate</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
                  <div className="text-3xl font-bold text-blue-600">{totalMinor}</div>
                  <div className="text-sm text-blue-600">Minor</div>
                </div>
              </div>
              
              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="🔍 Search pages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2"
                />
              </div>
              
              {/* Pages List */}
              <div className="space-y-2">
                {filteredResults.map((page, idx) => {
                  const pageTotal = (page.summary?.critical || 0) + (page.summary?.serious || 0) + 
                                   (page.summary?.moderate || 0) + (page.summary?.minor || 0);
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedPage(page)}
                      className="w-full text-left p-4 border rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="font-medium truncate">{page.title || 'Untitled'}</div>
                          <div className="text-sm text-gray-500 truncate">{page.url}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            pageTotal === 0 ? 'bg-green-100 text-green-600' :
                            (page.summary?.critical || 0) > 0 ? 'bg-red-100 text-red-600' :
                            (page.summary?.serious || 0) > 0 ? 'bg-orange-100 text-orange-600' :
                            'bg-yellow-100 text-yellow-600'
                          }`}>
                            {pageTotal} issues
                          </span>
                          <span className="text-gray-400">→</span>
                        </div>
                      </div>
                      
                      {/* Mini severity breakdown */}
                      <div className="mt-2 flex gap-3 text-xs">
                        {(page.summary?.critical || 0) > 0 && (
                          <span className="text-red-600">🔴 {page.summary?.critical}</span>
                        )}
                        {(page.summary?.serious || 0) > 0 && (
                          <span className="text-orange-600">🟠 {page.summary?.serious}</span>
                        )}
                        {(page.summary?.moderate || 0) > 0 && (
                          <span className="text-yellow-600">🟡 {page.summary?.moderate}</span>
                        )}
                        {(page.summary?.minor || 0) > 0 && (
                          <span className="text-blue-600">🔵 {page.summary?.minor}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
                
                {filteredResults.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No pages match your search
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex justify-between items-center">
          <p className="text-sm text-gray-500">
            Data from axe-core automated scans • For Lighthouse scores, use "Lighthouse Score" button
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}