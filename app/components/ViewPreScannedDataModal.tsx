'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  User,
  FileText,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  Loader2
} from 'lucide-react';
import {
  PreScannedData,
  PageScanResult,
  ScanIssue,
  loadPreScannedData,
  filterResultsByUrls,
  calculateTotals,
  formatScanDate,
  checkDataAvailability
} from './PreScannedDataService';

interface SelectedPage {
  url: string;
  title: string;
}

interface ViewPreScannedDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPages: SelectedPage[];
}

type SeverityFilter = 'all' | 'critical' | 'serious' | 'moderate' | 'minor';

export default function ViewPreScannedDataModal({
  isOpen,
  onClose,
  selectedPages
}: ViewPreScannedDataModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanData, setScanData] = useState<PreScannedData | null>(null);
  const [filteredResults, setFilteredResults] = useState<PageScanResult[]>([]);
  const [missingPages, setMissingPages] = useState<string[]>([]);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  // Load data when modal opens
  useEffect(() => {
    if (isOpen && selectedPages.length > 0) {
      loadData();
    }
  }, [isOpen, selectedPages]);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const data = await loadPreScannedData();
      
      if (!data) {
        setError('No pre-scanned data available. Please ask the admin to run scans first.');
        setLoading(false);
        return;
      }

      setScanData(data);

      // Get selected URLs
      const selectedUrls = selectedPages.map(p => p.url);

      // Check availability
      const { available, missing } = checkDataAvailability(data.results, selectedUrls);
      setMissingPages(missing);

      // Filter results
      const filtered = filterResultsByUrls(data.results, selectedUrls);
      setFilteredResults(filtered);

      // Auto-expand first page if only a few results
      if (filtered.length <= 3) {
        setExpandedPages(new Set(filtered.map(r => r.url)));
      }

    } catch (err) {
      setError('Failed to load pre-scanned data. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Toggle page expansion
  function togglePage(url: string) {
    const newExpanded = new Set(expandedPages);
    if (newExpanded.has(url)) {
      newExpanded.delete(url);
    } else {
      newExpanded.add(url);
    }
    setExpandedPages(newExpanded);
  }

  // Toggle issue expansion
  function toggleIssue(issueKey: string) {
    const newExpanded = new Set(expandedIssues);
    if (newExpanded.has(issueKey)) {
      newExpanded.delete(issueKey);
    } else {
      newExpanded.add(issueKey);
    }
    setExpandedIssues(newExpanded);
  }

  // Filter issues by severity
  function getFilteredIssues(issues: ScanIssue[]): ScanIssue[] {
    if (severityFilter === 'all') return issues;
    return issues.filter(issue => issue.impact === severityFilter);
  }

  // Get severity badge color
  function getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'serious': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'minor': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  // Get severity icon
  function getSeverityIcon(severity: string) {
    switch (severity) {
      case 'critical': return <AlertCircle className="w-4 h-4" />;
      case 'serious': return <AlertTriangle className="w-4 h-4" />;
      case 'moderate': return <Info className="w-4 h-4" />;
      case 'minor': return <Info className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  }

  if (!isOpen) return null;

  const totals = calculateTotals(filteredResults);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full my-8 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-xl flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">Latest Scan Data</h2>
                <p className="text-purple-200">Pre-scanned accessibility results</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
              <p className="text-gray-600">Loading pre-scanned data...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Scan Data Available</h3>
              <p className="text-gray-600 text-center max-w-md">{error}</p>
            </div>
          )}

          {/* Data Display */}
          {!loading && !error && scanData && (
            <>
              {/* Metadata Banner */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-5 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <Calendar className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Scan Date</p>
                      <p className="font-semibold text-gray-800">
                        {formatScanDate(scanData.metadata.scanDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Scanned By</p>
                      <p className="font-semibold text-gray-800">{scanData.metadata.scannedBy}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <FileText className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Showing</p>
                      <p className="font-semibold text-gray-800">
                        {filteredResults.length} of {scanData.metadata.totalPages} pages
                      </p>
                    </div>
                  </div>
                </div>
                {scanData.metadata.note && (
                  <p className="mt-3 text-sm text-gray-600 italic border-t border-purple-200 pt-3">
                    📝 {scanData.metadata.note}
                  </p>
                )}
              </div>

              {/* Missing Pages Warning */}
              {missingPages.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-yellow-800">
                        {missingPages.length} page(s) not in pre-scanned data
                      </p>
                      <p className="text-sm text-yellow-700 mt-1">
                        These pages haven't been scanned yet. Use "Real Scan" to scan them.
                      </p>
                      <ul className="mt-2 text-sm text-yellow-700">
                        {missingPages.slice(0, 3).map(url => (
                          <li key={url} className="truncate">• {url}</li>
                        ))}
                        {missingPages.length > 3 && (
                          <li>• ...and {missingPages.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* No Results for Selected Pages */}
              {filteredResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                  <AlertCircle className="w-16 h-16 text-gray-300 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">No Data for Selected Pages</h3>
                  <p className="text-gray-600 text-center max-w-md">
                    The selected pages haven't been pre-scanned yet. Please use "Real Scan" or ask the admin to include these pages in the next scan.
                  </p>
                </div>
              )}

              {/* Results Summary & Filter */}
              {filteredResults.length > 0 && (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    <button
                      onClick={() => setSeverityFilter('all')}
                      className={`p-4 rounded-xl border-2 transition ${
                        severityFilter === 'all'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl font-bold text-gray-800">{totals.total}</div>
                      <div className="text-xs text-gray-500 uppercase">Total Issues</div>
                    </button>
                    <button
                      onClick={() => setSeverityFilter('critical')}
                      className={`p-4 rounded-xl border-2 transition ${
                        severityFilter === 'critical'
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-red-200'
                      }`}
                    >
                      <div className="text-2xl font-bold text-red-600">{totals.critical}</div>
                      <div className="text-xs text-gray-500 uppercase">Critical</div>
                    </button>
                    <button
                      onClick={() => setSeverityFilter('serious')}
                      className={`p-4 rounded-xl border-2 transition ${
                        severityFilter === 'serious'
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-orange-200'
                      }`}
                    >
                      <div className="text-2xl font-bold text-orange-600">{totals.serious}</div>
                      <div className="text-xs text-gray-500 uppercase">Serious</div>
                    </button>
                    <button
                      onClick={() => setSeverityFilter('moderate')}
                      className={`p-4 rounded-xl border-2 transition ${
                        severityFilter === 'moderate'
                          ? 'border-yellow-500 bg-yellow-50'
                          : 'border-gray-200 hover:border-yellow-200'
                      }`}
                    >
                      <div className="text-2xl font-bold text-yellow-600">{totals.moderate}</div>
                      <div className="text-xs text-gray-500 uppercase">Moderate</div>
                    </button>
                    <button
                      onClick={() => setSeverityFilter('minor')}
                      className={`p-4 rounded-xl border-2 transition ${
                        severityFilter === 'minor'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-200'
                      }`}
                    >
                      <div className="text-2xl font-bold text-blue-600">{totals.minor}</div>
                      <div className="text-xs text-gray-500 uppercase">Minor</div>
                    </button>
                  </div>

                  {/* Filter indicator */}
                  {severityFilter !== 'all' && (
                    <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
                      <Filter className="w-4 h-4" />
                      <span>Filtering by: <strong className="capitalize">{severityFilter}</strong></span>
                      <button
                        onClick={() => setSeverityFilter('all')}
                        className="text-purple-600 hover:underline ml-2"
                      >
                        Clear filter
                      </button>
                    </div>
                  )}

                  {/* Page Results */}
                  <div className="space-y-4">
                    {filteredResults.map((page) => {
                      const pageIssues = getFilteredIssues(page.issues);
                      const isExpanded = expandedPages.has(page.url);

                      return (
                        <div key={page.url} className="border border-gray-200 rounded-xl overflow-hidden">
                          {/* Page Header */}
                          <button
                            onClick={() => togglePage(page.url)}
                            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition"
                          >
                            <div className="flex items-center gap-3 text-left">
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              )}
                              <div>
                                <h3 className="font-semibold text-gray-800">{page.title}</h3>
                                <p className="text-sm text-gray-500 truncate max-w-md">{page.url}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {page.summary.critical > 0 && (
                                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                                  {page.summary.critical} critical
                                </span>
                              )}
                              {page.summary.serious > 0 && (
                                <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                                  {page.summary.serious} serious
                                </span>
                              )}
                              <span className="px-3 py-1 text-sm font-medium bg-gray-200 text-gray-700 rounded-full">
                                {pageIssues.length} {severityFilter !== 'all' ? severityFilter : ''} issue{pageIssues.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </button>

                          {/* Page Issues */}
                          {isExpanded && (
                            <div className="p-4 space-y-3">
                              {pageIssues.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">
                                  No {severityFilter !== 'all' ? severityFilter : ''} issues found for this page.
                                </p>
                              ) : (
                                pageIssues.map((issue, idx) => {
                                  const issueKey = `${page.url}-${issue.id}-${idx}`;
                                  const isIssueExpanded = expandedIssues.has(issueKey);

                                  return (
                                    <div
                                      key={issueKey}
                                      className={`border rounded-lg overflow-hidden ${getSeverityColor(issue.impact)}`}
                                    >
                                      {/* Issue Header */}
                                      <button
                                        onClick={() => toggleIssue(issueKey)}
                                        className="w-full flex items-center justify-between p-3 text-left"
                                      >
                                        <div className="flex items-center gap-3">
                                          {getSeverityIcon(issue.impact)}
                                          <div>
                                            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded uppercase mr-2 ${getSeverityColor(issue.impact)}`}>
                                              {issue.impact}
                                            </span>
                                            <span className="font-medium">{issue.help}</span>
                                          </div>
                                        </div>
                                        {isIssueExpanded ? (
                                          <ChevronUp className="w-4 h-4" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4" />
                                        )}
                                      </button>

                                      {/* Issue Details */}
                                      {isIssueExpanded && (
                                        <div className="px-4 pb-4 space-y-3 bg-white/50">
                                          <div>
                                            <p className="text-sm font-medium text-gray-700">Description:</p>
                                            <p className="text-sm text-gray-600">{issue.description}</p>
                                          </div>
                                          
                                          {issue.nodes && issue.nodes.length > 0 && (
                                            <div>
                                              <p className="text-sm font-medium text-gray-700 mb-2">
                                                Affected Elements ({issue.nodes.length}):
                                              </p>
                                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                                {issue.nodes.slice(0, 5).map((node, nodeIdx) => (
                                                  <div key={nodeIdx} className="bg-gray-100 p-2 rounded text-xs">
                                                    <code className="block whitespace-pre-wrap break-all text-gray-700">
                                                      {node.html}
                                                    </code>
                                                    {node.failureSummary && (
                                                      <p className="mt-1 text-gray-600 italic">
                                                        {node.failureSummary}
                                                      </p>
                                                    )}
                                                  </div>
                                                ))}
                                                {issue.nodes.length > 5 && (
                                                  <p className="text-xs text-gray-500">
                                                    ...and {issue.nodes.length - 5} more elements
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                          )}

                                          {issue.helpUrl && (
                                            <a
                                              href={issue.helpUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 hover:underline"
                                            >
                                              <ExternalLink className="w-3 h-3" />
                                              Learn how to fix this
                                            </a>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 rounded-b-xl flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
