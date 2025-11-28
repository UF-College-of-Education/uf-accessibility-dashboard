// app/components/LatestDataModal.tsx
// Modal to display pre-scanned accessibility data (same UI as Real Scan)

'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  ChevronDown, 
  ChevronUp,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Loader2,
  Download,
  Calendar,
  ExternalLink
} from 'lucide-react';
import {
  PageScanData,
  fetchPageScanDataByUrl,
  LighthouseScores,
  IssueDetail
} from './LatestDataService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedPages: { 
    siteId: string; 
    siteBaseUrl: string; 
    pages: { url: string; title: string }[] 
  }[];
}

export default function LatestDataModal({ isOpen, onClose, selectedPages }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanData, setScanData] = useState<PageScanData[]>([]);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (isOpen && selectedPages.length > 0) {
      fetchAllData();
    }
  }, [isOpen, selectedPages]);

  async function fetchAllData() {
    setLoading(true);
    setError(null);
    setScanData([]);

    const totalPages = selectedPages.reduce((sum, site) => sum + site.pages.length, 0);
    setLoadingProgress({ current: 0, total: totalPages });

    const allData: PageScanData[] = [];
    let currentPage = 0;

    try {
      for (const site of selectedPages) {
        for (const page of site.pages) {
          const data = await fetchPageScanDataByUrl(page.url, site.siteBaseUrl);
          
          if (data) {
            allData.push(data);
          }
          
          currentPage++;
          setLoadingProgress({ current: currentPage, total: totalPages });
        }
      }

      if (allData.length === 0) {
        setError('No scan data found for the selected pages. Run auto-scan first or use Real Scan.');
      } else {
        setScanData(allData);
      }
    } catch (err) {
      setError(`Failed to load scan data: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  const togglePage = (url: string) => {
    const newExpanded = new Set(expandedPages);
    if (newExpanded.has(url)) {
      newExpanded.delete(url);
    } else {
      newExpanded.add(url);
    }
    setExpandedPages(newExpanded);
  };

  // Calculate summary
  const summary = scanData.length > 0 ? {
    totalPages: scanData.length,
    totalIssues: scanData.reduce((sum, p) => sum + p.issues.total, 0),
    critical: scanData.reduce((sum, p) => sum + p.issues.critical, 0),
    serious: scanData.reduce((sum, p) => sum + p.issues.serious, 0),
    moderate: scanData.reduce((sum, p) => sum + p.issues.moderate, 0),
    minor: scanData.reduce((sum, p) => sum + p.issues.minor, 0),
    avgPerformance: Math.round(scanData.reduce((sum, p) => sum + p.lighthouse.performance, 0) / scanData.length),
    avgAccessibility: Math.round(scanData.reduce((sum, p) => sum + p.lighthouse.accessibility, 0) / scanData.length),
    avgBestPractices: Math.round(scanData.reduce((sum, p) => sum + p.lighthouse.bestPractices, 0) / scanData.length),
    avgSeo: Math.round(scanData.reduce((sum, p) => sum + p.lighthouse.seo, 0) / scanData.length),
    latestScan: scanData.reduce((latest, p) => {
      const date = new Date(p.lastScanned);
      return date > new Date(latest) ? p.lastScanned : latest;
    }, scanData[0]?.lastScanned || ''),
  } : null;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-green-100';
    if (score >= 50) return 'bg-orange-100';
    return 'bg-red-100';
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'critical': return <AlertTriangle className="text-red-600" size={16} />;
      case 'serious': return <AlertCircle className="text-orange-600" size={16} />;
      case 'moderate': return <Info className="text-yellow-600" size={16} />;
      default: return <Info className="text-blue-600" size={16} />;
    }
  };

  const downloadReport = () => {
    if (!summary || scanData.length === 0) return;

    let report = `ACCESSIBILITY SCAN REPORT\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `Data from: ${summary.latestScan ? new Date(summary.latestScan).toLocaleString() : 'Unknown'}\n`;
    report += `${'='.repeat(60)}\n\n`;

    report += `SUMMARY\n${'-'.repeat(40)}\n`;
    report += `Total Pages: ${summary.totalPages}\n`;
    report += `Total Issues: ${summary.totalIssues}\n`;
    report += `  Critical: ${summary.critical}\n`;
    report += `  Serious: ${summary.serious}\n`;
    report += `  Moderate: ${summary.moderate}\n`;
    report += `  Minor: ${summary.minor}\n\n`;

    scanData.forEach(page => {
      report += `\n${page.title}\nURL: ${page.url}\n`;
      report += `Issues: ${page.issues.total}\n`;
    });

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accessibility-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-purple-700 text-white">
          <div className="flex items-center gap-3">
            <Database size={24} />
            <div>
              <h2 className="text-xl font-bold">Latest Scan Data</h2>
              <p className="text-purple-200 text-sm">Pre-scanned accessibility results</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-purple-800 rounded-lg transition">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={48} className="animate-spin text-purple-600 mb-4" />
              <p className="text-gray-600 mb-2">Loading scan data...</p>
              <p className="text-sm text-gray-500">
                {loadingProgress.current} / {loadingProgress.total} pages
              </p>
              <div className="w-64 bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{ width: `${loadingProgress.total > 0 ? (loadingProgress.current / loadingProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle size={48} className="text-red-500 mb-4" />
              <p className="text-gray-800 font-medium mb-2">No Scan Data Available</p>
              <p className="text-gray-600 text-center max-w-md">{error}</p>
            </div>
          )}

          {!loading && !error && summary && (
            <>
              {/* Scan Date */}
              <div className="flex items-center gap-2 mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <Calendar size={18} className="text-purple-600" />
                <span className="text-purple-800">
                  Data from: <strong>{new Date(summary.latestScan).toLocaleString()}</strong>
                </span>
              </div>

              {/* Lighthouse Scores */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Performance', value: summary.avgPerformance },
                  { label: 'Accessibility', value: summary.avgAccessibility },
                  { label: 'Best Practices', value: summary.avgBestPractices },
                  { label: 'SEO', value: summary.avgSeo },
                ].map((metric, idx) => (
                  <div key={idx} className={`p-4 rounded-lg ${getScoreBg(metric.value)}`}>
                    <div className="text-sm text-gray-600 mb-1">{metric.label}</div>
                    <div className={`text-3xl font-bold ${getScoreColor(metric.value)}`}>
                      {metric.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Issues Summary */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Issues Summary</h3>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: 'Total', value: summary.totalIssues, bg: 'bg-white' },
                    { label: 'Critical', value: summary.critical, bg: 'bg-red-50', border: 'border-red-200' },
                    { label: 'Serious', value: summary.serious, bg: 'bg-orange-50', border: 'border-orange-200' },
                    { label: 'Moderate', value: summary.moderate, bg: 'bg-yellow-50', border: 'border-yellow-200' },
                    { label: 'Minor', value: summary.minor, bg: 'bg-blue-50', border: 'border-blue-200' },
                  ].map((item, idx) => (
                    <div key={idx} className={`text-center p-3 rounded-lg border ${item.bg} ${item.border || ''}`}>
                      <div className={`text-2xl font-bold ${
                        item.label === 'Critical' ? 'text-red-600' :
                        item.label === 'Serious' ? 'text-orange-600' :
                        item.label === 'Moderate' ? 'text-yellow-600' :
                        item.label === 'Minor' ? 'text-blue-600' : 'text-gray-900'
                      }`}>{item.value}</div>
                      <div className="text-xs text-gray-600">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Page Details */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Page Details ({scanData.length} pages)</h3>
                
                {scanData.map((page, idx) => {
                  const isExpanded = expandedPages.has(page.url);
                  
                  return (
                    <div key={idx} className="border rounded-lg overflow-hidden">
                      <div 
                        className="flex items-center p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
                        onClick={() => togglePage(page.url)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{page.title}</div>
                          <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                            {page.url}
                            <a 
                              href={page.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 mr-3">
                          <div className="text-center">
                            <div className={`text-lg font-bold ${getScoreColor(page.lighthouse.accessibility)}`}>
                              {page.lighthouse.accessibility}
                            </div>
                            <div className="text-xs text-gray-500">A11y</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-gray-900">{page.issues.total}</div>
                            <div className="text-xs text-gray-500">Issues</div>
                          </div>
                        </div>
                        
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>

                      {isExpanded && (
                        <div className="border-t p-4 bg-white">
                          {page.issueDetails && page.issueDetails.length > 0 ? (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                              {page.issueDetails.map((issue, iIdx) => (
                                <div 
                                  key={iIdx}
                                  className={`p-3 rounded-lg border-l-4 ${
                                    issue.impact === 'critical' ? 'bg-red-50 border-red-500' :
                                    issue.impact === 'serious' ? 'bg-orange-50 border-orange-500' :
                                    issue.impact === 'moderate' ? 'bg-yellow-50 border-yellow-500' :
                                    'bg-blue-50 border-blue-500'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    {getImpactIcon(issue.impact)}
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900 text-sm">
                                        {issue.help || issue.description || issue.message}
                                      </div>
                                      <div className="text-xs text-gray-600 mt-1">{issue.id}</div>
                                    </div>
                                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                                      issue.impact === 'critical' ? 'bg-red-200 text-red-800' :
                                      issue.impact === 'serious' ? 'bg-orange-200 text-orange-800' :
                                      issue.impact === 'moderate' ? 'bg-yellow-200 text-yellow-800' :
                                      'bg-blue-200 text-blue-800'
                                    }`}>
                                      {issue.impact}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-green-600">
                              <CheckCircle size={18} />
                              <span>No accessibility issues found!</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {!loading && summary && (
              <>Showing {summary.totalPages} pages • {summary.totalIssues} total issues</>
            )}
          </div>
          <div className="flex gap-3">
            {!loading && summary && (
              <button
                onClick={downloadReport}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                <Download size={18} />
                Download Report
              </button>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
