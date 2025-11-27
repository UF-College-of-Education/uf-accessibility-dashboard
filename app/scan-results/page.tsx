'use client';

import { useState, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, ChevronDown, ChevronUp, ExternalLink, CheckCircle, X, Filter } from 'lucide-react';

interface IssueNode {
  html: string;
  target: string[];
  failureSummary: string;
}

interface Issue {
  id: string;
  impact: string;
  description: string;
  help: string;
  helpUrl: string;
  tags?: string[];
  nodes: IssueNode[];
  pageUrl?: string;
  pageTitle?: string;
}

interface ScanResult {
  success: boolean;
  totalScanned: number;
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  message: string;
  files: string[];
  timestamp: string;
  issues?: Issue[];
}

export default function ScanResultsPage() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'issues'>('summary');
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());
  const [filterImpact, setFilterImpact] = useState<string>('all');
  const [filterPage, setFilterPage] = useState<string>('all');
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  // Load results from localStorage on mount
  useEffect(() => {
    const storedResults = localStorage.getItem('scanResults');
    if (storedResults) {
      try {
        const parsed = JSON.parse(storedResults);
        setResult(parsed);
        console.log('📊 Loaded scan results:', parsed);
      } catch (e) {
        console.error('Failed to parse scan results:', e);
      }
    }
  }, []);

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Scan Results Found</h1>
          <p className="text-gray-600 mb-4">Please run a scan from the dashboard first.</p>
          <a 
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Get unique pages from issues
  const uniquePages = [...new Set((result.issues || []).map(issue => issue.pageUrl).filter(Boolean))];

  // Filter issues by page AND severity
  const filteredIssues = (result.issues || []).filter(issue => {
    const matchesImpact = filterImpact === 'all' || issue.impact === filterImpact;
    const matchesPage = filterPage === 'all' || issue.pageUrl === filterPage;
    return matchesImpact && matchesPage;
  });

  // Group issues by type
  const issuesByType = filteredIssues.reduce((acc, issue) => {
    if (!acc[issue.id]) {
      acc[issue.id] = {
        id: issue.id,
        impact: issue.impact,
        description: issue.description,
        help: issue.help,
        helpUrl: issue.helpUrl,
        instances: []
      };
    }
    acc[issue.id].instances.push(issue);
    return acc;
  }, {} as Record<string, any>);

  const groupedIssues = Object.values(issuesByType).sort((a: any, b: any) => {
    const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    return (order[a.impact as keyof typeof order] || 4) - (order[b.impact as keyof typeof order] || 4);
  });

  const toggleIssue = (index: number) => {
    const newExpanded = new Set(expandedIssues);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedIssues(newExpanded);
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-red-100 border-red-300 text-red-800';
      case 'serious': return 'bg-orange-100 border-orange-300 text-orange-800';
      case 'moderate': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'minor': return 'bg-blue-100 border-blue-300 text-blue-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'critical': return '🔴 Critical';
      case 'serious': return '🟠 Serious';
      case 'moderate': return '🟡 Moderate';
      case 'minor': return '🔵 Minor';
      default: return '⚪ Unknown';
    }
  };

  // Get page name from URL
  const getPageName = (url: string) => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      return pathParts[pathParts.length - 1] || urlObj.hostname;
    } catch {
      return url;
    }
  };

  // Download as Word Document
  const downloadAsWord = async () => {
    setIsDownloading('word');
    try {
      // Create HTML content for the Word document
      const htmlContent = generateWordHTML(result, filteredIssues);
      
      // Create blob and download
      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accessibility-report-${new Date().toISOString().split('T')[0]}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading Word:', error);
      alert('Failed to download Word document');
    } finally {
      setIsDownloading(null);
    }
  };

  // Download as Excel
  const downloadAsExcel = async () => {
    setIsDownloading('excel');
    try {
      // Create CSV content (Excel compatible)
      const csvContent = generateExcelCSV(result, result.issues || []);
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accessibility-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      alert('Failed to download Excel file');
    } finally {
      setIsDownloading(null);
    }
  };

  // Generate Word HTML
  const generateWordHTML = (result: ScanResult, issues: Issue[]) => {
    const date = new Date(result.timestamp).toLocaleString();
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Accessibility Audit Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    h3 { color: #4b5563; }
    .summary-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .severity-grid { display: flex; gap: 20px; margin: 20px 0; }
    .severity-item { padding: 15px; border-radius: 8px; text-align: center; flex: 1; }
    .critical { background: #fef2f2; border: 1px solid #fecaca; }
    .serious { background: #fff7ed; border: 1px solid #fed7aa; }
    .moderate { background: #fefce8; border: 1px solid #fef08a; }
    .minor { background: #eff6ff; border: 1px solid #bfdbfe; }
    .issue-card { border: 1px solid #e5e7eb; margin: 15px 0; padding: 15px; border-radius: 8px; }
    .issue-header { font-weight: bold; margin-bottom: 10px; }
    .code-block { background: #1f2937; color: #10b981; padding: 10px; font-family: monospace; font-size: 12px; overflow-x: auto; border-radius: 4px; margin: 10px 0; }
    .page-url { color: #2563eb; font-size: 12px; }
    .fix-suggestion { color: #dc2626; font-size: 12px; margin-top: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; }
    th { background: #f3f4f6; }
  </style>
</head>
<body>
  <h1>♿ Accessibility Audit Report</h1>
  <p><strong>Generated:</strong> ${date}</p>
  <p><strong>Tool:</strong> Playwright + axe-core via n8n</p>
  
  <div class="summary-box">
    <h2>📊 Summary</h2>
    <p><strong>Pages Scanned:</strong> ${result.totalScanned}</p>
    <p><strong>Total Issues Found:</strong> ${result.totalIssues}</p>
  </div>

  <h2>Issue Severity Breakdown</h2>
  <div class="severity-grid">
    <div class="severity-item critical">
      <div style="font-size: 24px; font-weight: bold;">${result.criticalCount}</div>
      <div>🔴 Critical</div>
    </div>
    <div class="severity-item serious">
      <div style="font-size: 24px; font-weight: bold;">${result.seriousCount}</div>
      <div>🟠 Serious</div>
    </div>
    <div class="severity-item moderate">
      <div style="font-size: 24px; font-weight: bold;">${result.moderateCount}</div>
      <div>🟡 Moderate</div>
    </div>
    <div class="severity-item minor">
      <div style="font-size: 24px; font-weight: bold;">${result.minorCount}</div>
      <div>🔵 Minor</div>
    </div>
  </div>

  <h2>📄 Pages Scanned</h2>
  <ul>
    ${result.files.map(file => `<li>${file}</li>`).join('\n    ')}
  </ul>

  <h2>🐛 Detailed Issues</h2>
  ${issues.map(issue => `
  <div class="issue-card">
    <div class="issue-header">${getImpactBadge(issue.impact)} - ${issue.id}</div>
    <p><strong>${issue.help}</strong></p>
    <p>${issue.description}</p>
    ${issue.pageUrl ? `<p class="page-url">📄 Page: ${issue.pageUrl}</p>` : ''}
    ${issue.nodes && issue.nodes[0] ? `
    <p><strong>Selector:</strong> ${issue.nodes[0].target?.join(' > ')}</p>
    <div class="code-block">${escapeHtml(issue.nodes[0].html)}</div>
    ${issue.nodes[0].failureSummary ? `<p class="fix-suggestion">⚠️ ${issue.nodes[0].failureSummary}</p>` : ''}
    ` : ''}
    ${issue.helpUrl ? `<p><a href="${issue.helpUrl}">Learn more about this issue →</a></p>` : ''}
  </div>
  `).join('\n')}

  <hr style="margin-top: 40px;">
  <p style="color: #6b7280; font-size: 12px;">
    Generated by UF College of Education Accessibility Dashboard<br>
    WCAG 2.1 Level AA Compliance Check
  </p>
</body>
</html>
    `;
  };

  // Generate Excel CSV
  const generateExcelCSV = (result: ScanResult, issues: Issue[]) => {
    const headers = [
      'Issue ID',
      'Severity',
      'Description',
      'Help Text',
      'Page URL',
      'Page Title',
      'CSS Selector',
      'HTML Element',
      'Fix Suggestion',
      'Learn More URL'
    ];

    const rows = issues.map(issue => [
      issue.id,
      issue.impact,
      `"${(issue.description || '').replace(/"/g, '""')}"`,
      `"${(issue.help || '').replace(/"/g, '""')}"`,
      issue.pageUrl || '',
      issue.pageTitle || '',
      `"${(issue.nodes?.[0]?.target?.join(' > ') || '').replace(/"/g, '""')}"`,
      `"${(issue.nodes?.[0]?.html || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${(issue.nodes?.[0]?.failureSummary || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      issue.helpUrl || ''
    ]);

    // Add summary rows at the top
    const summaryRows = [
      ['ACCESSIBILITY AUDIT REPORT'],
      [`Generated: ${new Date(result.timestamp).toLocaleString()}`],
      [''],
      ['SUMMARY'],
      [`Pages Scanned,${result.totalScanned}`],
      [`Total Issues,${result.totalIssues}`],
      [`Critical,${result.criticalCount}`],
      [`Serious,${result.seriousCount}`],
      [`Moderate,${result.moderateCount}`],
      [`Minor,${result.minorCount}`],
      [''],
      ['DETAILED ISSUES'],
      headers
    ];

    return [...summaryRows.map(row => row.join(',')), ...rows.map(row => row.join(','))].join('\n');
  };

  // Escape HTML for Word document
  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              🎯 Accessibility Scan Results
            </h1>
            <p className="text-green-100 mt-1">
              Scanned {result.totalScanned} pages • Found {result.totalIssues} issues
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={downloadAsWord}
              disabled={isDownloading === 'word'}
              className="flex items-center gap-2 px-4 py-2 bg-white text-green-700 rounded-lg hover:bg-green-50 transition font-semibold disabled:opacity-50"
            >
              <FileText size={20} />
              {isDownloading === 'word' ? 'Downloading...' : 'Download Word'}
            </button>
            <button
              onClick={downloadAsExcel}
              disabled={isDownloading === 'excel'}
              className="flex items-center gap-2 px-4 py-2 bg-white text-green-700 rounded-lg hover:bg-green-50 transition font-semibold disabled:opacity-50"
            >
              <FileSpreadsheet size={20} />
              {isDownloading === 'excel' ? 'Downloading...' : 'Download Excel'}
            </button>
            <a
              href="/"
              className="flex items-center gap-2 px-4 py-2 bg-green-800 text-white rounded-lg hover:bg-green-900 transition"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex border-b mb-6 bg-white rounded-t-lg">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-6 py-4 font-semibold transition ${
              activeTab === 'summary' 
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            📊 Summary
          </button>
          <button
            onClick={() => setActiveTab('issues')}
            className={`px-6 py-4 font-semibold transition ${
              activeTab === 'issues' 
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            🐛 Issues ({result.totalIssues})
          </button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-b-lg shadow-lg p-6">
          {activeTab === 'summary' ? (
            <>
              {/* Summary Card */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h3 className="font-bold text-blue-900 mb-4 text-xl">Summary</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <span className="text-gray-600">Pages Scanned:</span>
                    <span className="font-bold text-blue-600 ml-2 text-2xl">{result.totalScanned}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Issues:</span>
                    <span className="font-bold text-blue-600 ml-2 text-2xl">{result.totalIssues}</span>
                  </div>
                </div>
              </div>

              {/* Issue Severity Breakdown */}
              <div className="mb-6">
                <h3 className="font-bold text-gray-900 mb-4 text-xl">Issue Severity</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-red-600">{result.criticalCount}</div>
                    <div className="text-sm text-red-700 mt-1">🔴 Critical</div>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-orange-600">{result.seriousCount}</div>
                    <div className="text-sm text-orange-700 mt-1">🟠 Serious</div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-yellow-600">{result.moderateCount}</div>
                    <div className="text-sm text-yellow-700 mt-1">🟡 Moderate</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600">{result.minorCount}</div>
                    <div className="text-sm text-blue-700 mt-1">🔵 Minor</div>
                  </div>
                </div>
              </div>

              {/* Scanned Pages */}
              <div className="mb-6">
                <h3 className="font-bold text-gray-900 mb-4 text-xl">Scanned Pages</h3>
                <div className="bg-gray-50 border rounded-lg p-4 max-h-64 overflow-y-auto">
                  {result.files.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 py-2 border-b last:border-0">
                      <CheckCircle className="text-green-600" size={18} />
                      <span className="text-gray-700">{file}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timestamp */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-semibold">{result.message}</p>
                <p className="text-green-600 text-sm mt-1">
                  Timestamp: {new Date(result.timestamp).toLocaleString()}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Filters */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                {/* Page Filter */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Filter size={16} className="text-gray-600" />
                    <span className="text-gray-700 font-semibold">Filter by Page:</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setFilterPage('all')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        filterPage === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      All Pages ({result.issues?.length || 0})
                    </button>
                    {uniquePages.map((pageUrl, idx) => {
                      const pageIssueCount = (result.issues || []).filter(i => i.pageUrl === pageUrl).length;
                      return (
                        <button
                          key={idx}
                          onClick={() => setFilterPage(pageUrl || 'all')}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            filterPage === pageUrl
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {getPageName(pageUrl || '')} ({pageIssueCount})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Severity Filter */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-700 font-semibold">Filter by Severity:</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {['all', 'critical', 'serious', 'moderate', 'minor'].map(impact => (
                      <button
                        key={impact}
                        onClick={() => setFilterImpact(impact)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          filterImpact === impact
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {impact === 'all' ? 'All Severities' : getImpactBadge(impact)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filter Status */}
                <div className="mt-3 text-sm text-gray-600">
                  Showing {filteredIssues.length} of {result.issues?.length || 0} issues
                </div>
              </div>

              {/* Issues List */}
              {filteredIssues.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">No issues match the current filters.</p>
                  <p className="text-sm mt-2">Try adjusting your filter selections.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedIssues.map((issueGroup: any, idx: number) => (
                    <div 
                      key={idx} 
                      className={`border-2 rounded-lg overflow-hidden ${getImpactColor(issueGroup.impact)}`}
                    >
                      <div 
                        className="p-4 cursor-pointer flex justify-between items-start hover:bg-opacity-80 transition"
                        onClick={() => toggleIssue(idx)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${getImpactColor(issueGroup.impact)}`}>
                              {getImpactBadge(issueGroup.impact)}
                            </span>
                            <span className="text-gray-600 text-sm font-medium">
                              {issueGroup.instances.length} instance(s)
                            </span>
                          </div>
                          <h4 className="font-bold text-gray-900 text-lg">{issueGroup.id}</h4>
                          <p className="text-gray-700 mt-1">{issueGroup.help}</p>
                        </div>
                        <div className="ml-4">
                          {expandedIssues.has(idx) ? (
                            <ChevronUp size={24} className="text-gray-500" />
                          ) : (
                            <ChevronDown size={24} className="text-gray-500" />
                          )}
                        </div>
                      </div>
                      
                      {expandedIssues.has(idx) && (
                        <div className="border-t bg-white p-4">
                          <p className="text-gray-600 mb-4">{issueGroup.description}</p>
                          
                          {issueGroup.helpUrl && (
                            <a 
                              href={issueGroup.helpUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-blue-600 hover:underline mb-4 font-medium"
                            >
                              <ExternalLink size={16} />
                              Learn more about this issue
                            </a>
                          )}

                          <h5 className="font-semibold text-gray-800 mb-3 text-lg">Affected Elements:</h5>
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {issueGroup.instances.map((instance: any, iIdx: number) => (
                              <div key={iIdx} className="bg-gray-50 rounded-lg p-4 border">
                                {instance.pageUrl && (
                                  <div className="text-sm text-blue-600 mb-2 font-medium">
                                    📄 {instance.pageUrl}
                                  </div>
                                )}
                                {instance.nodes && instance.nodes[0] && (
                                  <>
                                    <div className="text-xs text-gray-500 mb-2">
                                      <strong>Selector:</strong> {instance.nodes[0].target?.join(' > ')}
                                    </div>
                                    <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                                      {instance.nodes[0].html}
                                    </pre>
                                    {instance.nodes[0].failureSummary && (
                                      <p className="text-sm text-red-600 mt-3 p-2 bg-red-50 rounded whitespace-pre-wrap">
                                        ⚠️ {instance.nodes[0].failureSummary}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>UF College of Education | Accessibility Compliance Tool</p>
          <p className="mt-1">WCAG 2.1 Level AA • Powered by Playwright + axe-core</p>
        </div>
      </div>
    </div>
  );
}