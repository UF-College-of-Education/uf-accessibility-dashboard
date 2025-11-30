// app/components/ResultsModal.tsx
// COMPACT VERSION - Smaller boxes, better space usage

'use client';

import { useState } from 'react';

interface PageResult {
  url: string;
  pageTitle?: string;
  scores: {
    accessibility: number;
  };
  accessibilityIssues?: Array<{
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
  }>;
  summary?: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    total: number;
    passed: number;
  };
}

interface SiteResult {
  siteUrl: string;
  siteName: string;
  pages: PageResult[];
}

interface ResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: SiteResult[];
}

export default function ResultsModal({ isOpen, onClose, results }: ResultsModalProps) {
  const [selectedPage, setSelectedPage] = useState<PageResult | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  // Calculate totals
  const sites = results;
  const totalPages = sites.reduce((acc, site) => acc + site.pages.length, 0);
  
  const allPages = sites.flatMap(site => site.pages);
  const avgAccessibility = allPages.length > 0 
    ? Math.round(allPages.reduce((acc, p) => acc + (p.scores?.accessibility || 0), 0) / allPages.length)
    : 0;

  // Calculate severity counts across all pages
  const severityCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  allPages.forEach(page => {
    if (page.summary) {
      severityCounts.critical += page.summary.critical;
      severityCounts.serious += page.summary.serious;
      severityCounts.moderate += page.summary.moderate;
      severityCounts.minor += page.summary.minor;
    } else if (page.accessibilityIssues) {
      page.accessibilityIssues.forEach(issue => {
        severityCounts[issue.impact]++;
      });
    }
  });
  
  const totalIssues = severityCounts.critical + severityCounts.serious + severityCounts.moderate + severityCounts.minor;

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

  const downloadReport = () => {
    let report = `Accessibility Audit Report\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `${'='.repeat(50)}\n\n`;
    report += `SUMMARY\n`;
    report += `-`.repeat(30) + `\n`;
    report += `Sites Audited: ${sites.length}\n`;
    report += `Pages Scanned: ${totalPages}\n`;
    report += `Average Accessibility Score: ${avgAccessibility}\n`;
    report += `Total Issues: ${totalIssues}\n`;
    report += `  - Critical: ${severityCounts.critical}\n`;
    report += `  - Serious: ${severityCounts.serious}\n`;
    report += `  - Moderate: ${severityCounts.moderate}\n`;
    report += `  - Minor: ${severityCounts.minor}\n\n`;

    sites.forEach(site => {
      report += `${'='.repeat(50)}\n`;
      report += `SITE: ${site.siteName}\n`;
      report += `URL: ${site.siteUrl}\n`;
      report += `${'='.repeat(50)}\n\n`;

      site.pages.forEach(page => {
        report += `PAGE: ${page.url}\n`;
        report += `-`.repeat(40) + `\n`;
        report += `Accessibility Score: ${page.scores?.accessibility || 0}\n`;
        
        if (page.accessibilityIssues && page.accessibilityIssues.length > 0) {
          report += `Issues Found: ${page.accessibilityIssues.length}\n\n`;
          page.accessibilityIssues.forEach((issue, idx) => {
            report += `  ${idx + 1}. [${issue.impact.toUpperCase()}] ${issue.title}\n`;
            report += `     Rule: ${issue.id}\n`;
            if (issue.nodes && issue.nodes.length > 0) {
              report += `     Affected Elements: ${issue.nodes.length}\n`;
            }
            report += `\n`;
          });
        } else {
          report += `No accessibility issues found!\n\n`;
        }
      });
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col my-auto">
        {/* Header - Compact */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">♿</span> Accessibility Results
              </h2>
              <p className="text-green-100 text-xs mt-1">
                {new Date().toLocaleString()} • Real Google Lighthouse Scores
              </p>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">&times;</button>
          </div>

          {/* Compact Stats Row */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            <div className="bg-green-700/50 rounded-lg p-2 text-center">
              <div className="text-xl font-bold">{sites.length}</div>
              <div className="text-[10px] text-green-100">Sites</div>
            </div>
            <div className="bg-green-700/50 rounded-lg p-2 text-center">
              <div className="text-xl font-bold">{totalPages}</div>
              <div className="text-[10px] text-green-100">Pages</div>
            </div>
            <div className="bg-green-700/50 rounded-lg p-2 text-center">
              <div className="text-xl font-bold">{avgAccessibility}</div>
              <div className="text-[10px] text-green-100">Avg Score</div>
            </div>
            <div className="bg-green-700/50 rounded-lg p-2 text-center">
              <div className="text-xl font-bold">{totalIssues}</div>
              <div className="text-[10px] text-green-100">Issues</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedPage ? (
            // Individual Page View
            <div>
              <button
                onClick={() => setSelectedPage(null)}
                className="text-green-600 hover:text-green-800 mb-3 flex items-center gap-1 text-sm"
              >
                ← Back to all pages
              </button>

              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <h3 className="font-semibold text-gray-800 text-sm truncate">{selectedPage.url}</h3>
                <div className="flex items-center gap-4 mt-2">
                  <div className={`text-2xl font-bold ${getScoreColor(selectedPage.scores?.accessibility || 0)}`}>
                    {selectedPage.scores?.accessibility || 0}
                  </div>
                  <span className="text-gray-500 text-sm">Accessibility Score</span>
                  <span className="text-gray-400 text-sm">•</span>
                  <span className="text-gray-600 text-sm">{selectedPage.accessibilityIssues?.length || 0} issues</span>
                </div>
              </div>

              {/* Issues List */}
              <div className="space-y-2">
                {selectedPage.accessibilityIssues && selectedPage.accessibilityIssues.length > 0 ? (
                  selectedPage.accessibilityIssues.map((issue) => (
                    <div key={issue.id} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleIssue(issue.id)}
                        className="w-full p-3 flex items-center justify-between hover:bg-gray-50 text-left"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getImpactColor(issue.impact)}`}>
                            {issue.impact}
                          </span>
                          <span className="font-medium text-gray-800 text-sm truncate">{issue.title}</span>
                        </div>
                        <span className="text-gray-400 ml-2">{expandedIssues.has(issue.id) ? '▼' : '▶'}</span>
                      </button>

                      {expandedIssues.has(issue.id) && (
                        <div className="border-t bg-gray-50 p-3 text-sm">
                          <div className="mb-2">
                            <code className="bg-gray-200 px-2 py-0.5 rounded text-xs">{issue.id}</code>
                          </div>
                          
                          <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3 text-xs">
                            <strong className="text-blue-800">Why it matters:</strong>
                            <p className="text-blue-700 mt-1" dangerouslySetInnerHTML={{ 
                              __html: issue.description.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="underline">$1</a>')
                            }} />
                          </div>

                          {issue.nodes && issue.nodes.length > 0 && (
                            <div>
                              <strong className="text-gray-700 text-xs">Affected Elements ({issue.nodes.length}):</strong>
                              <div className="mt-1 space-y-2">
                                {issue.nodes.slice(0, 5).map((node, idx) => (
                                  <div key={idx} className="bg-white border rounded p-2 text-xs">
                                    {node.target && (
                                      <div className="text-gray-500 mb-1 truncate">
                                        <span className="font-medium">Selector:</span> {node.target}
                                      </div>
                                    )}
                                    {node.html && (
                                      <pre className="bg-gray-100 p-2 rounded overflow-x-auto text-xs">
                                        <code>{node.html}</code>
                                      </pre>
                                    )}
                                    {node.failureSummary && (
                                      <div className="text-red-600 mt-1 text-xs">{node.failureSummary}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-3 flex gap-2 text-xs">
                            <a 
                              href={`https://dequeuniversity.com/rules/axe/4.4/${issue.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              Learn more →
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">✓</div>
                    <p>No accessibility issues found!</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Overview
            <div>
              {/* Compact Score + Severity Row */}
              <div className="flex flex-wrap items-stretch gap-3 mb-4">
                {/* Score Box - Compact */}
                <div className={`${getScoreBg(avgAccessibility)} border rounded-lg p-3 flex items-center gap-3`}>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 flex items-center gap-1 justify-center">
                      <span className="text-blue-500">♿</span> Accessibility
                    </div>
                    <div className={`text-3xl font-bold ${getScoreColor(avgAccessibility)}`}>
                      {avgAccessibility}
                    </div>
                    <div className="w-24 h-1.5 bg-gray-200 rounded-full mt-1">
                      <div 
                        className={`h-full rounded-full ${avgAccessibility >= 90 ? 'bg-green-500' : avgAccessibility >= 50 ? 'bg-orange-500' : 'bg-red-500'}`}
                        style={{ width: `${avgAccessibility}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">
                      {avgAccessibility >= 90 ? '✓ Good' : avgAccessibility >= 50 ? '⚠ Needs Work' : '✗ Poor'}
                    </div>
                  </div>
                </div>

                {/* Severity Counts - Compact Inline */}
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-600 mb-1.5">Issues by Severity</div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-red-600">{severityCounts.critical}</div>
                      <div className="text-[10px] text-red-600">🔴 Critical</div>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-orange-600">{severityCounts.serious}</div>
                      <div className="text-[10px] text-orange-600">🟠 Serious</div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-yellow-600">{severityCounts.moderate}</div>
                      <div className="text-[10px] text-yellow-600">🟡 Moderate</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-blue-600">{severityCounts.minor}</div>
                      <div className="text-[10px] text-blue-600">🔵 Minor</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pages List */}
              <h3 className="font-semibold text-gray-800 mb-2 text-sm">Individual Pages</h3>
              <div className="space-y-2">
                {sites.map(site => (
                  site.pages.map((page, pageIdx) => (
                    <div 
                      key={`${site.siteUrl}-${pageIdx}`}
                      onClick={() => setSelectedPage(page)}
                      className="border rounded-lg p-3 hover:border-green-300 hover:bg-green-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="font-medium text-gray-800 text-sm truncate">
                            {page.pageTitle || page.url.split('/').pop() || 'Home'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{page.url}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <div className={`text-lg font-bold ${getScoreColor(page.scores?.accessibility || 0)}`}>
                              ♿ {page.scores?.accessibility || 0}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-gray-700">
                              {page.accessibilityIssues?.length || page.summary?.total || 0}
                            </div>
                            <div className="text-[10px] text-gray-500">Issues</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Compact */}
        <div className="border-t p-3 flex justify-between items-center bg-gray-50">
          <button
            onClick={downloadReport}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            📥 Download Report
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}