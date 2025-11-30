// app/results/page.tsx
// This page opens in a NEW BROWSER TAB to show accessibility results

'use client';

import { useEffect, useState } from 'react';
import { Download, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from 'lucide-react';

interface AuditIssue {
  type: 'error' | 'warning';
  code: string;
  wcagPrinciple: string;
  message: string;
  selector: string;
  codeSnippet: string;
  recommendation?: string;
}

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

interface AuditPageResult {
  url: string;
  title: string;
  status: string;
  issues: AuditIssue[];
  timestamp: number;
  lighthouseScores?: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  lighthouseAccessibilityIssues?: LighthouseIssue[];
  summary?: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    total: number;
    passed: number;
  };
}

interface AuditRun {
  id: string;
  dateString: string;
  results: AuditPageResult[];
  siteCount: number;
  pageCount: number;
  totalIssues: number;
}

export default function ResultsPage() {
  const [auditRun, setAuditRun] = useState<AuditRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'critical' | 'serious' | 'moderate' | 'minor'>('all');

  useEffect(() => {
    // Get results from sessionStorage
    const storedResults = sessionStorage.getItem('auditResults');
    if (storedResults) {
      try {
        setAuditRun(JSON.parse(storedResults));
      } catch (e) {
        console.error('Failed to parse results:', e);
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!auditRun) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow">
          <div className="text-6xl mb-4">📋</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">No Results Found</h1>
          <p className="text-gray-600 mb-4">Run a scan first to see accessibility results here.</p>
          <a href="/" className="text-green-600 hover:underline">← Back to Dashboard</a>
        </div>
      </div>
    );
  }

  // Calculate severity counts from Lighthouse data
  const severityCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  auditRun.results.forEach(page => {
    if (page.summary) {
      severityCounts.critical += page.summary.critical;
      severityCounts.serious += page.summary.serious;
      severityCounts.moderate += page.summary.moderate;
      severityCounts.minor += page.summary.minor;
    } else if (page.lighthouseAccessibilityIssues) {
      page.lighthouseAccessibilityIssues.forEach(issue => {
        severityCounts[issue.impact]++;
      });
    }
  });
  const totalIssues = severityCounts.critical + severityCounts.serious + severityCounts.moderate + severityCounts.minor;

  // Calculate average accessibility score
  const avgAccessibility = auditRun.results.length > 0
    ? Math.round(auditRun.results.reduce((acc, p) => acc + (p.lighthouseScores?.accessibility || 0), 0) / auditRun.results.length)
    : 0;

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

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'serious': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'minor': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const toggleIssue = (issueId: string) => {
    const newExpanded = new Set(expandedIssues);
    if (newExpanded.has(issueId)) {
      newExpanded.delete(issueId);
    } else {
      newExpanded.add(issueId);
    }
    setExpandedIssues(newExpanded);
  };

  const getFilteredIssues = (issues: LighthouseIssue[] = []) => {
    if (filterType === 'all') return issues;
    return issues.filter(i => i.impact === filterType);
  };

  const downloadReport = () => {
    let report = `ACCESSIBILITY AUDIT REPORT\n`;
    report += `Generated: ${auditRun.dateString}\n`;
    report += `${'='.repeat(60)}\n\n`;
    report += `SUMMARY\n`;
    report += `-`.repeat(40) + `\n`;
    report += `Sites Audited: ${auditRun.siteCount}\n`;
    report += `Pages Scanned: ${auditRun.pageCount}\n`;
    report += `Average Accessibility Score: ${avgAccessibility}\n`;
    report += `Total Issues: ${totalIssues}\n`;
    report += `  - Critical: ${severityCounts.critical}\n`;
    report += `  - Serious: ${severityCounts.serious}\n`;
    report += `  - Moderate: ${severityCounts.moderate}\n`;
    report += `  - Minor: ${severityCounts.minor}\n\n`;

    auditRun.results.forEach((result, idx) => {
      report += `${'='.repeat(60)}\n`;
      report += `PAGE ${idx + 1}: ${result.title}\n`;
      report += `URL: ${result.url}\n`;
      report += `Accessibility Score: ${result.lighthouseScores?.accessibility || 0}\n`;
      report += `${'='.repeat(60)}\n\n`;

      if (result.lighthouseAccessibilityIssues && result.lighthouseAccessibilityIssues.length > 0) {
        report += `Issues Found: ${result.lighthouseAccessibilityIssues.length}\n\n`;
        result.lighthouseAccessibilityIssues.forEach((issue, issueIdx) => {
          report += `  ${issueIdx + 1}. [${issue.impact.toUpperCase()}] ${issue.title}\n`;
          report += `     Rule: ${issue.id}\n`;
          if (issue.nodes && issue.nodes.length > 0) {
            report += `     Affected Elements: ${issue.nodes.length}\n`;
          }
          report += `\n`;
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
    a.download = `accessibility-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg print:bg-green-700">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-3xl">♿</span> Accessibility Results
              </h1>
              <p className="text-green-100 text-sm mt-1">
                {auditRun.dateString} • Real Google Lighthouse Scores
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={downloadReport}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm flex items-center gap-2"
              >
                <Download size={16} /> Download Report
              </button>
              <a
                href="/"
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
              >
                ← Back to Dashboard
              </a>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="bg-green-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{auditRun.siteCount}</div>
              <div className="text-xs text-green-100">Sites</div>
            </div>
            <div className="bg-green-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{auditRun.pageCount}</div>
              <div className="text-xs text-green-100">Pages</div>
            </div>
            <div className="bg-green-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{avgAccessibility}</div>
              <div className="text-xs text-green-100">Avg Score</div>
            </div>
            <div className="bg-green-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{totalIssues}</div>
              <div className="text-xs text-green-100">Total Issues</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Score + Severity Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Score Box */}
          <div className={`${getScoreBg(avgAccessibility)} border rounded-xl p-5`}>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-sm text-gray-500 flex items-center gap-1 justify-center mb-1">
                  <span className="text-blue-500 text-xl">♿</span> Accessibility Score
                </div>
                <div className={`text-5xl font-bold ${getScoreColor(avgAccessibility)}`}>
                  {avgAccessibility}
                </div>
                <div className="w-32 h-2 bg-gray-200 rounded-full mt-2 mx-auto">
                  <div 
                    className={`h-full rounded-full ${avgAccessibility >= 90 ? 'bg-green-500' : avgAccessibility >= 50 ? 'bg-orange-500' : 'bg-red-500'}`}
                    style={{ width: `${avgAccessibility}%` }}
                  />
                </div>
                <div className="text-sm text-gray-500 mt-2">
                  {avgAccessibility >= 90 ? '✓ Good' : avgAccessibility >= 50 ? '⚠ Needs Improvement' : '✗ Poor'}
                </div>
              </div>
            </div>
          </div>

          {/* Severity Counts */}
          <div className="bg-white border rounded-xl p-5">
            <div className="text-sm font-medium text-gray-600 mb-3">Issues by Severity</div>
            <div className="grid grid-cols-4 gap-2">
              <div 
                onClick={() => setFilterType(filterType === 'critical' ? 'all' : 'critical')}
                className={`bg-red-50 border rounded-lg p-3 text-center cursor-pointer transition ${filterType === 'critical' ? 'border-red-500 ring-2 ring-red-200' : 'border-red-200 hover:border-red-400'}`}
              >
                <div className="text-xl font-bold text-red-600">{severityCounts.critical}</div>
                <div className="text-xs text-red-600">🔴 Critical</div>
              </div>
              <div 
                onClick={() => setFilterType(filterType === 'serious' ? 'all' : 'serious')}
                className={`bg-orange-50 border rounded-lg p-3 text-center cursor-pointer transition ${filterType === 'serious' ? 'border-orange-500 ring-2 ring-orange-200' : 'border-orange-200 hover:border-orange-400'}`}
              >
                <div className="text-xl font-bold text-orange-600">{severityCounts.serious}</div>
                <div className="text-xs text-orange-600">🟠 Serious</div>
              </div>
              <div 
                onClick={() => setFilterType(filterType === 'moderate' ? 'all' : 'moderate')}
                className={`bg-yellow-50 border rounded-lg p-3 text-center cursor-pointer transition ${filterType === 'moderate' ? 'border-yellow-500 ring-2 ring-yellow-200' : 'border-yellow-200 hover:border-yellow-400'}`}
              >
                <div className="text-xl font-bold text-yellow-600">{severityCounts.moderate}</div>
                <div className="text-xs text-yellow-600">🟡 Moderate</div>
              </div>
              <div 
                onClick={() => setFilterType(filterType === 'minor' ? 'all' : 'minor')}
                className={`bg-blue-50 border rounded-lg p-3 text-center cursor-pointer transition ${filterType === 'minor' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-200 hover:border-blue-400'}`}
              >
                <div className="text-xl font-bold text-blue-600">{severityCounts.minor}</div>
                <div className="text-xs text-blue-600">🔵 Minor</div>
              </div>
            </div>
            {filterType !== 'all' && (
              <button 
                onClick={() => setFilterType('all')}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700"
              >
                Clear filter ×
              </button>
            )}
          </div>
        </div>

        {/* Pages List */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-800 text-lg">Scanned Pages</h3>
          </div>
          
          <div className="divide-y">
            {auditRun.results.map((result, idx) => {
              const isExpanded = expandedPage === result.url;
              const pageIssues = getFilteredIssues(result.lighthouseAccessibilityIssues || []);
              const pageScore = result.lighthouseScores?.accessibility || 0;

              return (
                <div key={idx}>
                  {/* Page Header */}
                  <div
                    onClick={() => setExpandedPage(isExpanded ? null : result.url)}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-gray-400">
                          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 truncate">{result.title}</div>
                          <div className="text-sm text-gray-500 truncate">{result.url}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 ml-4">
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${getScoreColor(pageScore)}`}>
                            ♿ {pageScore}
                          </div>
                          <div className="text-xs text-gray-500">Score</div>
                        </div>
                        <div className="text-center min-w-[60px]">
                          <div className="text-2xl font-bold text-gray-700">
                            {result.lighthouseAccessibilityIssues?.length || 0}
                          </div>
                          <div className="text-xs text-gray-500">Issues</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Issues */}
                  {isExpanded && (
                    <div className="border-t bg-gray-50 p-4">
                      {pageIssues.length > 0 ? (
                        <div className="space-y-3">
                          {pageIssues.map((issue) => (
                            <div key={issue.id} className="bg-white border rounded-lg overflow-hidden">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleIssue(issue.id);
                                }}
                                className="w-full p-3 flex items-center justify-between hover:bg-gray-50 text-left"
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getImpactColor(issue.impact)}`}>
                                    {issue.impact}
                                  </span>
                                  <span className="font-medium text-gray-800 truncate">{issue.title}</span>
                                </div>
                                <span className="text-gray-400 ml-2">
                                  {expandedIssues.has(issue.id) ? '▼' : '▶'}
                                </span>
                              </button>

                              {expandedIssues.has(issue.id) && (
                                <div className="border-t bg-gray-50 p-4">
                                  <div className="mb-3">
                                    <code className="bg-gray-200 px-2 py-1 rounded text-sm">{issue.id}</code>
                                  </div>
                                  
                                  <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                                    <strong className="text-blue-800">Why it matters:</strong>
                                    <p className="text-blue-700 mt-1 text-sm" dangerouslySetInnerHTML={{ 
                                      __html: issue.description.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="underline">$1</a>')
                                    }} />
                                  </div>

                                  {issue.nodes && issue.nodes.length > 0 && (
                                    <div>
                                      <strong className="text-gray-700 text-sm">Affected Elements ({issue.nodes.length}):</strong>
                                      <div className="mt-2 space-y-2">
                                        {issue.nodes.slice(0, 5).map((node, nodeIdx) => (
                                          <div key={nodeIdx} className="bg-white border rounded p-3 text-sm">
                                            {node.target && (
                                              <div className="text-gray-500 mb-1 truncate text-xs">
                                                <span className="font-medium">Selector:</span> {node.target}
                                              </div>
                                            )}
                                            {node.html && (
                                              <pre className="bg-gray-100 p-2 rounded overflow-x-auto text-xs mt-1">
                                                <code>{node.html}</code>
                                              </pre>
                                            )}
                                            {node.failureSummary && (
                                              <div className="text-red-600 mt-2 text-xs">{node.failureSummary}</div>
                                            )}
                                          </div>
                                        ))}
                                        {issue.nodes.length > 5 && (
                                          <p className="text-gray-500 text-xs">...and {issue.nodes.length - 5} more elements</p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  <div className="mt-4">
                                    <a 
                                      href={`https://dequeuniversity.com/rules/axe/4.4/${issue.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline text-sm"
                                    >
                                      Learn more about this issue →
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500 bg-green-50 rounded-lg">
                          <div className="text-4xl mb-2">✓</div>
                          <p className="font-medium text-green-700">
                            {filterType === 'all' ? 'No accessibility issues found!' : `No ${filterType} issues found`}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>UF College of Education | Accessibility Compliance Tool</p>
          <p className="mt-1">Powered by Google Lighthouse</p>
        </div>
      </main>
    </div>
  );
}