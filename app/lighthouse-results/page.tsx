'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, Download, AlertTriangle, CheckCircle } from 'lucide-react';

// Types for Lighthouse results
interface LighthouseIssue {
  id: string;
  title: string;
  description: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  score: number | null;
  nodes: Array<{
    html: string;
    target: string;
    failureSummary?: string;
  }>;
}

interface LighthousePageResult {
  url: string;
  title: string;
  score: number;
  issues: LighthouseIssue[];
  summary: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    total: number;
    passed: number;
  };
  timestamp: string;
}

interface LighthouseResults {
  pages: LighthousePageResult[];
  totalPages: number;
  avgScore: number;
  totalIssues: number;
  timestamp: string;
}

export default function LighthouseResultsPage() {
  const [results, setResults] = useState<LighthouseResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<LighthousePageResult | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  useEffect(() => {
    // Load results from sessionStorage
    const storedResults = sessionStorage.getItem('lighthouseResults');
    
    if (storedResults) {
      try {
        const parsed = JSON.parse(storedResults);
        setResults(parsed);
      } catch (e) {
        setError('Failed to parse Lighthouse results');
      }
    } else {
      setError('No Lighthouse results found. Please run a Lighthouse scan first.');
    }
    
    setLoading(false);
  }, []);

  const toggleIssue = (issueId: string) => {
    const newExpanded = new Set(expandedIssues);
    if (newExpanded.has(issueId)) {
      newExpanded.delete(issueId);
    } else {
      newExpanded.add(issueId);
    }
    setExpandedIssues(newExpanded);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-green-50 border-green-200';
    if (score >= 50) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  const getScoreRing = (score: number) => {
    if (score >= 90) return 'ring-green-500';
    if (score >= 50) return 'ring-orange-500';
    return 'ring-red-500';
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'serious': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'minor': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
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

  const downloadReport = () => {
    if (!results) return;

    let report = `LIGHTHOUSE ACCESSIBILITY REPORT\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `${'='.repeat(60)}\n\n`;
    report += `SUMMARY\n`;
    report += `-`.repeat(40) + `\n`;
    report += `Pages Scanned: ${results.totalPages}\n`;
    report += `Average Accessibility Score: ${results.avgScore}\n`;
    report += `Total Issues: ${results.totalIssues}\n\n`;

    results.pages.forEach(page => {
      report += `${'='.repeat(60)}\n`;
      report += `PAGE: ${page.title}\n`;
      report += `URL: ${page.url}\n`;
      report += `Score: ${page.score}\n`;
      report += `-`.repeat(40) + `\n`;
      
      if (page.issues.length > 0) {
        report += `Issues (${page.issues.length}):\n\n`;
        page.issues.forEach((issue, idx) => {
          report += `  ${idx + 1}. [${issue.impact.toUpperCase()}] ${issue.title}\n`;
          report += `     Rule: ${issue.id}\n`;
          report += `     ${issue.description}\n\n`;
        });
      } else {
        report += `No accessibility issues found!\n`;
      }
      report += `\n`;
    });

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lighthouse-accessibility-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate totals
  const totals = results ? {
    critical: results.pages.reduce((sum, p) => sum + p.summary.critical, 0),
    serious: results.pages.reduce((sum, p) => sum + p.summary.serious, 0),
    moderate: results.pages.reduce((sum, p) => sum + p.summary.moderate, 0),
    minor: results.pages.reduce((sum, p) => sum + p.summary.minor, 0),
  } : { critical: 0, serious: 0, moderate: 0, minor: 0 };

  // Filter issues
  const getFilteredIssues = (issues: LighthouseIssue[]) => {
    if (filterSeverity === 'all') return issues;
    return issues.filter(issue => issue.impact === filterSeverity);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">Loading Lighthouse results...</p>
        </div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <AlertTriangle className="mx-auto text-orange-500 mb-4" size={64} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No Results Found</h1>
          <p className="text-gray-600 mb-6">{error || 'Please run a Lighthouse scan from the dashboard first.'}</p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            ← Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <span className="text-4xl">🔍</span>
                Lighthouse Accessibility Results
              </h1>
              <p className="text-blue-100 mt-2">
                Google PageSpeed Insights API • Real Accessibility Scores
              </p>
              <p className="text-blue-200 text-sm mt-1">
                {new Date(results.timestamp).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={downloadReport}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
              >
                <Download size={18} />
                Download Report
              </button>
              <a
                href="/"
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
              >
                ← Dashboard
              </a>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{results.totalPages}</div>
              <div className="text-xs text-blue-100">Pages Scanned</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{results.avgScore}</div>
              <div className="text-xs text-blue-100">Avg Score</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{results.totalIssues}</div>
              <div className="text-xs text-blue-100">Total Issues</div>
            </div>
            <div className="bg-red-500/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{totals.critical}</div>
              <div className="text-xs text-red-100">Critical</div>
            </div>
            <div className="bg-orange-500/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{totals.serious}</div>
              <div className="text-xs text-orange-100">Serious</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {selectedPage ? (
          // Single Page Detail View
          <div>
            <button
              onClick={() => setSelectedPage(null)}
              className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
            >
              ← Back to all pages
            </button>

            {/* Page Header */}
            <div className={`${getScoreBg(selectedPage.score)} border rounded-xl p-6 mb-6`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 truncate">{selectedPage.title}</h2>
                  <a
                    href={selectedPage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm flex items-center gap-1 mt-1"
                  >
                    {selectedPage.url}
                    <ExternalLink size={14} />
                  </a>
                </div>
                <div className={`text-center p-4 rounded-xl ring-4 ${getScoreRing(selectedPage.score)} bg-white`}>
                  <div className={`text-4xl font-bold ${getScoreColor(selectedPage.score)}`}>
                    {selectedPage.score}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Accessibility</div>
                </div>
              </div>

              {/* Severity Breakdown */}
              <div className="grid grid-cols-4 gap-3 mt-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-red-600">{selectedPage.summary.critical}</div>
                  <div className="text-xs text-red-600">🔴 Critical</div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-orange-600">{selectedPage.summary.serious}</div>
                  <div className="text-xs text-orange-600">🟠 Serious</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-yellow-600">{selectedPage.summary.moderate}</div>
                  <div className="text-xs text-yellow-600">🟡 Moderate</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-blue-600">{selectedPage.summary.minor}</div>
                  <div className="text-xs text-blue-600">🔵 Minor</div>
                </div>
              </div>
            </div>

            {/* Filter */}
            <div className="mb-4 flex gap-2 flex-wrap">
              <span className="text-gray-600 py-2 font-medium">Filter:</span>
              {['all', 'critical', 'serious', 'moderate', 'minor'].map(severity => (
                <button
                  key={severity}
                  onClick={() => setFilterSeverity(severity)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    filterSeverity === severity
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {severity === 'all' ? 'All Issues' : `${getImpactEmoji(severity)} ${severity.charAt(0).toUpperCase() + severity.slice(1)}`}
                </button>
              ))}
            </div>

            {/* Issues List */}
            <div className="space-y-3">
              {getFilteredIssues(selectedPage.issues).length === 0 ? (
                <div className="text-center py-12 bg-green-50 rounded-xl border border-green-200">
                  <CheckCircle className="mx-auto text-green-500 mb-3" size={48} />
                  <p className="text-green-700 font-semibold">No issues match the current filter</p>
                </div>
              ) : (
                getFilteredIssues(selectedPage.issues).map((issue, idx) => (
                  <div key={`${issue.id}-${idx}`} className="border rounded-xl overflow-hidden bg-white shadow-sm">
                    <button
                      onClick={() => toggleIssue(`${issue.id}-${idx}`)}
                      className="w-full p-4 flex items-start justify-between hover:bg-gray-50 text-left"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-xl">{getImpactEmoji(issue.impact)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getImpactColor(issue.impact)}`}>
                              {issue.impact}
                            </span>
                            <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{issue.id}</code>
                          </div>
                          <h4 className="font-semibold text-gray-900 mt-1">{issue.title}</h4>
                        </div>
                      </div>
                      <span className="text-gray-400 ml-2">
                        {expandedIssues.has(`${issue.id}-${idx}`) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </span>
                    </button>

                    {expandedIssues.has(`${issue.id}-${idx}`) && (
                      <div className="border-t bg-gray-50 p-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                          <p className="text-blue-800 text-sm" dangerouslySetInnerHTML={{
                            __html: issue.description.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="underline text-blue-600">$1</a>')
                          }} />
                        </div>

                        {issue.nodes && issue.nodes.length > 0 && (
                          <div>
                            <h5 className="font-semibold text-gray-800 mb-2">Affected Elements ({issue.nodes.length}):</h5>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {issue.nodes.slice(0, 5).map((node, nodeIdx) => (
                                <div key={nodeIdx} className="bg-white border rounded-lg p-3 text-sm">
                                  {node.target && (
                                    <div className="text-gray-500 mb-1 text-xs">
                                      <strong>Selector:</strong> <code className="text-purple-600">{node.target}</code>
                                    </div>
                                  )}
                                  {node.html && (
                                    <pre className="bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto mt-2">
                                      <code>{node.html}</code>
                                    </pre>
                                  )}
                                  {node.failureSummary && (
                                    <p className="text-red-600 text-xs mt-2 bg-red-50 p-2 rounded">
                                      ⚠️ {node.failureSummary}
                                    </p>
                                  )}
                                </div>
                              ))}
                              {issue.nodes.length > 5 && (
                                <p className="text-gray-500 text-sm text-center py-2">
                                  ...and {issue.nodes.length - 5} more elements
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="mt-4">
                          <a
                            href={`https://dequeuniversity.com/rules/axe/4.4/${issue.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                          >
                            Learn more about this issue
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          // All Pages Overview
          <div>
            {/* Average Score Card */}
            <div className="flex items-center justify-center mb-8">
              <div className={`${getScoreBg(results.avgScore)} border rounded-2xl p-8 text-center shadow-lg`}>
                <div className="text-sm text-gray-600 mb-2 flex items-center justify-center gap-2">
                  <span className="text-2xl">♿</span> Average Accessibility Score
                </div>
                <div className={`text-6xl font-bold ${getScoreColor(results.avgScore)}`}>
                  {results.avgScore}
                </div>
                <div className="w-48 h-2 bg-gray-200 rounded-full mt-4 mx-auto overflow-hidden">
                  <div
                    className={`h-full rounded-full ${results.avgScore >= 90 ? 'bg-green-500' : results.avgScore >= 50 ? 'bg-orange-500' : 'bg-red-500'}`}
                    style={{ width: `${results.avgScore}%` }}
                  />
                </div>
                <div className="text-sm text-gray-500 mt-2">
                  {results.avgScore >= 90 ? '✓ Good' : results.avgScore >= 50 ? '⚠ Needs Improvement' : '✗ Poor'}
                </div>
              </div>
            </div>

            {/* Severity Summary */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-red-600">{totals.critical}</div>
                <div className="text-sm text-red-600">🔴 Critical</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-orange-600">{totals.serious}</div>
                <div className="text-sm text-orange-600">🟠 Serious</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600">{totals.moderate}</div>
                <div className="text-sm text-yellow-600">🟡 Moderate</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{totals.minor}</div>
                <div className="text-sm text-blue-600">🔵 Minor</div>
              </div>
            </div>

            {/* Pages List */}
            <h2 className="text-xl font-bold text-gray-900 mb-4">Individual Pages</h2>
            <div className="space-y-3">
              {results.pages.map((page, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedPage(page)}
                  className="w-full text-left bg-white border rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{page.title}</h3>
                      <p className="text-sm text-gray-500 truncate">{page.url}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`text-center px-4 py-2 rounded-lg ${getScoreBg(page.score)}`}>
                        <div className={`text-2xl font-bold ${getScoreColor(page.score)}`}>
                          {page.score}
                        </div>
                        <div className="text-xs text-gray-500">Score</div>
                      </div>
                      <div className="text-center px-4 py-2 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-gray-700">
                          {page.summary.total}
                        </div>
                        <div className="text-xs text-gray-500">Issues</div>
                      </div>
                      <span className="text-gray-400">→</span>
                    </div>
                  </div>
                  
                  {/* Mini severity breakdown */}
                  {page.summary.total > 0 && (
                    <div className="mt-2 flex gap-3 text-xs">
                      {page.summary.critical > 0 && (
                        <span className="text-red-600">🔴 {page.summary.critical} critical</span>
                      )}
                      {page.summary.serious > 0 && (
                        <span className="text-orange-600">🟠 {page.summary.serious} serious</span>
                      )}
                      {page.summary.moderate > 0 && (
                        <span className="text-yellow-600">🟡 {page.summary.moderate} moderate</span>
                      )}
                      {page.summary.minor > 0 && (
                        <span className="text-blue-600">🔵 {page.summary.minor} minor</span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t bg-gray-50 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          <p>Powered by Google PageSpeed Insights API • Lighthouse Accessibility Audit</p>
        </div>
      </div>
    </div>
  );
}