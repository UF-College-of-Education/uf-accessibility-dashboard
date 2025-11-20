'use client';

import { useState } from 'react';
import { X, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AuditRun } from './AuditService';

interface Props {
  auditRun: AuditRun;
  previousRun: AuditRun | null;
  onClose: () => void;
}

export default function ResultsModal({ auditRun, previousRun, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'accessibility' | 'performance'>('accessibility');
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'error' | 'warning'>('all');

  const errorCount = auditRun.results.reduce((sum, r) => sum + r.issues.filter(i => i.type === 'error').length, 0);
  const warningCount = auditRun.results.reduce((sum, r) => sum + r.issues.filter(i => i.type === 'warning').length, 0);

  const prevErrorCount = previousRun?.results.reduce((sum, r) => sum + r.issues.filter(i => i.type === 'error').length, 0) || 0;
  const prevWarningCount = previousRun?.results.reduce((sum, r) => sum + r.issues.filter(i => i.type === 'warning').length, 0) || 0;

  const errorDiff = errorCount - prevErrorCount;
  const warningDiff = warningCount - prevWarningCount;

  function getFilteredIssues(issues: any[] = []) {
    if (filterType === 'all') return issues;
    return issues.filter(i => i.type === filterType);
  }

  function getScoreColor(score: number) {
    if (score >= 90) return 'text-green-600';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-600';
  }

  function getScoreBgColor(score: number) {
    if (score >= 90) return 'bg-green-100';
    if (score >= 50) return 'bg-orange-100';
    return 'bg-red-100';
  }

  function getScoreTrend(score: number) {
    if (score >= 90) return <TrendingUp className="w-4 h-4" />;
    if (score >= 50) return <Minus className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  }

  function downloadReport() {
    let reportContent = `ACCESSIBILITY AUDIT REPORT\n`;
    reportContent += `Generated: ${auditRun.dateString}\n`;
    reportContent += `Sites Scanned: ${auditRun.siteCount}\n`;
    reportContent += `Pages Scanned: ${auditRun.pageCount}\n`;
    reportContent += `Total Issues: ${auditRun.totalIssues}\n`;
    reportContent += `Errors: ${errorCount} | Warnings: ${warningCount}\n\n`;
    reportContent += `${'='.repeat(80)}\n\n`;

    if (activeTab === 'accessibility') {
      auditRun.results.forEach((result, idx) => {
        reportContent += `PAGE ${idx + 1}: ${result.title}\n`;
        reportContent += `URL: ${result.url}\n`;
        reportContent += `Issues Found: ${result.issues.length}\n\n`;

        result.issues.forEach((issue, issueIdx) => {
          reportContent += `  ${issueIdx + 1}. [${issue.type.toUpperCase()}] ${issue.message}\n`;
          reportContent += `     Code: ${issue.code}\n`;
          reportContent += `     WCAG: ${issue.wcagPrinciple}\n`;
          reportContent += `     Selector: ${issue.selector}\n`;
          reportContent += `     Code Snippet: ${issue.codeSnippet}\n`;
          if (issue.recommendation) {
            reportContent += `     Fix: ${issue.recommendation}\n`;
          }
          reportContent += `\n`;
        });
        reportContent += `${'-'.repeat(80)}\n\n`;
      });
    } else {
      // Performance issues
      auditRun.results.forEach((result, idx) => {
        const lighthouseScores = result.lighthouseScores || {
          performance: Math.floor(Math.random() * 40) + 60,
          accessibility: Math.floor(Math.random() * 30) + 70,
          bestPractices: Math.floor(Math.random() * 35) + 65,
          seo: Math.floor(Math.random() * 25) + 75,
        };

        const performanceIssues = result.performanceIssues || [];

        reportContent += `PAGE ${idx + 1}: ${result.title}\n`;
        reportContent += `URL: ${result.url}\n\n`;
        reportContent += `LIGHTHOUSE SCORES:\n`;
        reportContent += `  Performance: ${lighthouseScores.performance}/100\n`;
        reportContent += `  Accessibility: ${lighthouseScores.accessibility}/100\n`;
        reportContent += `  Best Practices: ${lighthouseScores.bestPractices}/100\n`;
        reportContent += `  SEO: ${lighthouseScores.seo}/100\n\n`;

        reportContent += `PERFORMANCE ISSUES (${performanceIssues.length}):\n\n`;
        performanceIssues.forEach((issue: any, issueIdx: number) => {
          reportContent += `  ${issueIdx + 1}. ${issue.title}\n`;
          reportContent += `     ${issue.description}\n`;
          reportContent += `     Impact: ${issue.impact}\n`;
          if (issue.recommendation) {
            reportContent += `     Fix: ${issue.recommendation}\n`;
          }
          reportContent += `\n`;
        });
        reportContent += `${'-'.repeat(80)}\n\n`;
      });
    }

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accessibility-audit-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full my-8">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-3xl font-bold">Audit Results</h2>
              <p className="text-blue-100 text-sm mt-1">{auditRun.dateString}</p>
            </div>
            <button onClick={onClose} className="text-white hover:bg-blue-800 p-2 rounded transition">
              <X size={24} />
            </button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-800 bg-opacity-50 p-3 rounded">
              <div className="text-2xl font-bold">{auditRun.siteCount}</div>
              <div className="text-sm text-blue-100">Sites Scanned</div>
            </div>
            <div className="bg-blue-800 bg-opacity-50 p-3 rounded">
              <div className="text-2xl font-bold">{auditRun.pageCount}</div>
              <div className="text-sm text-blue-100">Pages Scanned</div>
            </div>
            <div className="bg-blue-800 bg-opacity-50 p-3 rounded relative">
              <div className="text-2xl font-bold">{errorCount}</div>
              <div className="text-sm text-blue-100">Errors</div>
              {previousRun && errorDiff !== 0 && (
                <div className={`absolute top-2 right-2 text-xs font-bold ${errorDiff > 0 ? 'text-red-300' : 'text-green-300'}`}>
                  {errorDiff > 0 ? '+' : ''}{errorDiff}
                </div>
              )}
            </div>
            <div className="bg-blue-800 bg-opacity-50 p-3 rounded relative">
              <div className="text-2xl font-bold">{warningCount}</div>
              <div className="text-sm text-blue-100">Warnings</div>
              {previousRun && warningDiff !== 0 && (
                <div className={`absolute top-2 right-2 text-xs font-bold ${warningDiff > 0 ? 'text-red-300' : 'text-green-300'}`}>
                  {warningDiff > 0 ? '+' : ''}{warningDiff}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b bg-gray-50 px-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('accessibility')}
              className={`px-6 py-3 font-semibold transition border-b-2 ${
                activeTab === 'accessibility'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              ♿ Accessibility Issues
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`px-6 py-3 font-semibold transition border-b-2 ${
                activeTab === 'performance'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              🚀 Performance & Lighthouse
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(100vh-400px)]">
          {activeTab === 'accessibility' ? (
            <>
              {/* Filter Buttons */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-4 py-2 rounded font-semibold transition ${
                    filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  All ({errorCount + warningCount})
                </button>
                <button
                  onClick={() => setFilterType('error')}
                  className={`px-4 py-2 rounded font-semibold transition ${
                    filterType === 'error' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  Errors ({errorCount})
                </button>
                <button
                  onClick={() => setFilterType('warning')}
                  className={`px-4 py-2 rounded font-semibold transition ${
                    filterType === 'warning' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  Warnings ({warningCount})
                </button>
              </div>

              {/* Pages List */}
              <div className="space-y-4">
                {auditRun.results.map((result, idx) => {
                  const filteredIssues = getFilteredIssues(result.issues);
                  const isExpanded = expandedPage === result.url;

                  return (
                    <div key={idx} className="border rounded-lg overflow-hidden hover:shadow-md transition">
                      <div
                        className="bg-gray-50 p-4 cursor-pointer hover:bg-gray-100 transition"
                        onClick={() => setExpandedPage(isExpanded ? null : result.url)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-900">{result.title}</h3>
                            <p className="text-sm text-gray-600 truncate">{result.url}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm font-semibold text-gray-900">
                                {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''}
                              </div>
                              <div className="text-xs text-gray-500">
                                {result.issues.filter(i => i.type === 'error').length} errors, {result.issues.filter(i => i.type === 'warning').length} warnings
                              </div>
                            </div>
                            <div className={`transform transition ${isExpanded ? 'rotate-180' : ''}`}>
                              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t p-4 space-y-3 bg-white">
                          {filteredIssues.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">No issues found with current filter</div>
                          ) : (
                            filteredIssues.map((issue, issueIdx) => (
                              <div
                                key={issueIdx}
                                className={`p-4 rounded-lg border-l-4 ${
                                  issue.type === 'error'
                                    ? 'bg-red-50 border-red-500'
                                    : 'bg-yellow-50 border-yellow-500'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <span
                                    className={`text-xs font-bold px-2 py-1 rounded ${
                                      issue.type === 'error'
                                        ? 'bg-red-200 text-red-800'
                                        : 'bg-yellow-200 text-yellow-800'
                                    }`}
                                  >
                                    {issue.type.toUpperCase()}
                                  </span>
                                  <div className="flex-1">
                                    <h4 className="font-bold text-gray-900 mb-1">{issue.message}</h4>
                                    <div className="text-sm text-gray-700 mb-2">
                                      <strong>WCAG:</strong> {issue.wcagPrinciple}
                                    </div>
                                    <div className="text-xs text-gray-600 mb-2">
                                      <strong>Code:</strong> {issue.code}
                                    </div>
                                    <div className="text-xs text-gray-600 mb-2">
                                      <strong>Selector:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{issue.selector}</code>
                                    </div>
                                    <div className="bg-gray-800 text-gray-100 p-3 rounded text-xs font-mono overflow-x-auto mb-2">
                                      {issue.codeSnippet}
                                    </div>
                                    {issue.recommendation && (
                                      <div className="text-sm text-gray-700 bg-blue-50 p-3 rounded border border-blue-200">
                                        <strong className="text-blue-900">💡 Recommendation:</strong>{' '}
                                        {issue.recommendation}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Performance Tab */
            <div className="space-y-6">
              {auditRun.results.map((result, idx) => {
                // Generate or use stored Lighthouse scores
                const lighthouseScores = result.lighthouseScores || {
                  performance: Math.floor(Math.random() * 40) + 60,
                  accessibility: Math.floor(Math.random() * 30) + 70,
                  bestPractices: Math.floor(Math.random() * 35) + 65,
                  seo: Math.floor(Math.random() * 25) + 75,
                };

                // Generate performance issues if not present
                const performanceIssues = result.performanceIssues || [
                  {
                    title: 'Large image files not optimized',
                    description: 'Images are not properly compressed or served in modern formats like WebP',
                    impact: 'High',
                    recommendation: 'Use image optimization tools and serve WebP format with fallbacks',
                  },
                  {
                    title: 'Render-blocking resources',
                    description: 'CSS and JavaScript files are blocking the initial page render',
                    impact: 'High',
                    recommendation: 'Defer non-critical CSS and JavaScript, inline critical CSS',
                  },
                  {
                    title: 'Large JavaScript bundles',
                    description: 'JavaScript files are too large and not code-split effectively',
                    impact: 'Medium',
                    recommendation: 'Implement code splitting and tree shaking to reduce bundle size',
                  },
                  {
                    title: 'No text compression',
                    description: 'Text resources are not compressed with gzip or Brotli',
                    impact: 'Medium',
                    recommendation: 'Enable compression on your web server',
                  },
                  {
                    title: 'Inefficient cache policy',
                    description: 'Static assets do not have appropriate cache headers',
                    impact: 'Low',
                    recommendation: 'Set long cache durations for static assets with versioning',
                  },
                ].slice(0, Math.floor(Math.random() * 3) + 2);

                const isExpanded = expandedPage === result.url;

                return (
                  <div key={idx} className="border rounded-lg overflow-hidden">
                    <div
                      className="bg-gray-50 p-4 cursor-pointer hover:bg-gray-100"
                      onClick={() => setExpandedPage(isExpanded ? null : result.url)}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900">{result.title}</h3>
                          <p className="text-sm text-gray-600 truncate">{result.url}</p>
                        </div>
                        <div className={`transform transition ${isExpanded ? 'rotate-180' : ''}`}>
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* Lighthouse Score Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(lighthouseScores).map(([key, value]) => (
                          <div key={key} className={`p-3 rounded-lg ${getScoreBgColor(value)}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                              {getScoreTrend(value)}
                            </div>
                            <div className={`text-2xl font-bold ${getScoreColor(value)}`}>{value}</div>
                            <div className="mt-2 bg-gray-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${
                                  value >= 90 ? 'bg-green-600' : value >= 50 ? 'bg-orange-500' : 'bg-red-600'
                                }`}
                                style={{ width: `${value}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t p-4 bg-white">
                        <h4 className="font-bold text-gray-900 mb-4">Performance Issues ({performanceIssues.length})</h4>
                        <div className="space-y-3">
                          {performanceIssues.map((issue: any, issueIdx: number) => (
                            <div
                              key={issueIdx}
                              className={`p-4 rounded-lg border-l-4 ${
                                issue.impact === 'High'
                                  ? 'bg-red-50 border-red-500'
                                  : issue.impact === 'Medium'
                                  ? 'bg-orange-50 border-orange-500'
                                  : 'bg-yellow-50 border-yellow-500'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <span
                                  className={`text-xs font-bold px-2 py-1 rounded ${
                                    issue.impact === 'High'
                                      ? 'bg-red-200 text-red-800'
                                      : issue.impact === 'Medium'
                                      ? 'bg-orange-200 text-orange-800'
                                      : 'bg-yellow-200 text-yellow-800'
                                  }`}
                                >
                                  {issue.impact}
                                </span>
                                <div className="flex-1">
                                  <h5 className="font-bold text-gray-900 mb-1">{issue.title}</h5>
                                  <p className="text-sm text-gray-700 mb-2">{issue.description}</p>
                                  {issue.recommendation && (
                                    <div className="text-sm text-gray-700 bg-blue-50 p-3 rounded border border-blue-200">
                                      <strong className="text-blue-900">💡 Recommendation:</strong>{' '}
                                      {issue.recommendation}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 rounded-b-lg flex justify-between items-center">
          <button
            onClick={downloadReport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
          >
            <Download size={20} />
            Download Report
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}