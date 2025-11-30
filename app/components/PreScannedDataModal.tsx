// app/components/PreScannedDataModal.tsx
// OPTION A: Matches Real Scan UI exactly with all filters

'use client';

import { useState, useMemo } from 'react';
import { X, ChevronDown, ChevronUp, ExternalLink, FileText, Filter, Tag, AlertTriangle, CheckCircle } from 'lucide-react';

// Types
interface ScanIssueNode {
  html: string;
  target: string | string[];
  failureSummary: string;
}

interface ScanIssue {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  nodes: ScanIssueNode[];
}

interface PageScanResult {
  url: string;
  title: string;
  site: string;
  scannedAt?: string;
  scannedBy?: string;
  issues: ScanIssue[];
  summary: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

interface ScanMetadata {
  scanDate: string;
  scannedBy: string;
  totalPages: number;
  totalIssues?: number;
  note?: string;
  summary?: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  metadata: ScanMetadata | null;
  results: PageScanResult[];
  missingPages: string[];
  totalScannedInData: number;
}

// Category mapping (same as scan-results page)
const ISSUE_CATEGORIES: Record<string, { name: string; icon: string }> = {
  'color-contrast': { name: 'Color Contrast', icon: '🎨' },
  'image-alt': { name: 'Image Alt Text', icon: '🖼️' },
  'input-image-alt': { name: 'Image Alt Text', icon: '🖼️' },
  'label': { name: 'Form Labels', icon: '📝' },
  'label-title-only': { name: 'Form Labels', icon: '📝' },
  'form-field-multiple-labels': { name: 'Form Labels', icon: '📝' },
  'select-name': { name: 'Form Labels', icon: '📝' },
  'button-name': { name: 'Button/Link Names', icon: '🔘' },
  'link-name': { name: 'Button/Link Names', icon: '🔗' },
  'link-in-text-block': { name: 'Button/Link Names', icon: '🔗' },
  'aria-allowed-attr': { name: 'ARIA Attributes', icon: '♿' },
  'aria-hidden-body': { name: 'ARIA Attributes', icon: '♿' },
  'aria-hidden-focus': { name: 'ARIA Attributes', icon: '♿' },
  'aria-required-attr': { name: 'ARIA Attributes', icon: '♿' },
  'aria-required-children': { name: 'ARIA Attributes', icon: '♿' },
  'aria-required-parent': { name: 'ARIA Attributes', icon: '♿' },
  'aria-roles': { name: 'ARIA Attributes', icon: '♿' },
  'aria-valid-attr': { name: 'ARIA Attributes', icon: '♿' },
  'aria-valid-attr-value': { name: 'ARIA Attributes', icon: '♿' },
  'heading-order': { name: 'Heading Structure', icon: '📑' },
  'empty-heading': { name: 'Heading Structure', icon: '📑' },
  'page-has-heading-one': { name: 'Heading Structure', icon: '📑' },
  'focus-order-semantics': { name: 'Keyboard/Focus', icon: '⌨️' },
  'tabindex': { name: 'Keyboard/Focus', icon: '⌨️' },
  'accesskeys': { name: 'Keyboard/Focus', icon: '⌨️' },
  'landmark-one-main': { name: 'Landmarks', icon: '🗺️' },
  'region': { name: 'Landmarks', icon: '🗺️' },
  'bypass': { name: 'Landmarks', icon: '🗺️' },
  'duplicate-id': { name: 'HTML Validity', icon: '🔧' },
  'duplicate-id-active': { name: 'HTML Validity', icon: '🔧' },
  'duplicate-id-aria': { name: 'HTML Validity', icon: '🔧' },
  'meta-viewport': { name: 'Zoom/Scaling', icon: '🔍' },
  'html-has-lang': { name: 'Page Structure', icon: '🌐' },
  'html-lang-valid': { name: 'Page Structure', icon: '🌐' },
  'document-title': { name: 'Page Structure', icon: '📄' },
};

function getCategoryForIssue(issueId: string): { name: string; icon: string } {
  const category = ISSUE_CATEGORIES[issueId];
  if (category) return category;
  if (issueId.startsWith('aria-')) return { name: 'ARIA Attributes', icon: '♿' };
  if (issueId.includes('color') || issueId.includes('contrast')) return { name: 'Color Contrast', icon: '🎨' };
  if (issueId.includes('label') || issueId.includes('form')) return { name: 'Form Labels', icon: '📝' };
  if (issueId.includes('button') || issueId.includes('link')) return { name: 'Button/Link Names', icon: '🔗' };
  if (issueId.includes('heading')) return { name: 'Heading Structure', icon: '📑' };
  if (issueId.includes('focus') || issueId.includes('keyboard')) return { name: 'Keyboard/Focus', icon: '⌨️' };
  if (issueId.includes('image') || issueId.includes('alt')) return { name: 'Image Alt Text', icon: '🖼️' };
  if (issueId.includes('region') || issueId.includes('landmark')) return { name: 'Landmarks', icon: '🗺️' };
  return { name: 'Other', icon: '📌' };
}

function getPageName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    return pathParts[pathParts.length - 1] || urlObj.hostname;
  } catch {
    return url;
  }
}

export default function PreScannedDataModal({ 
  isOpen, 
  onClose, 
  metadata, 
  results, 
  missingPages,
  totalScannedInData
}: Props) {
  const [activeTab, setActiveTab] = useState<'summary' | 'issues'>('summary');
  const [filterImpact, setFilterImpact] = useState<string>('all');
  const [filterPage, setFilterPage] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());

  // Calculate totals from results
  const totals = useMemo(() => {
    return results.reduce((acc, page) => {
      acc.critical += page.summary?.critical || 0;
      acc.serious += page.summary?.serious || 0;
      acc.moderate += page.summary?.moderate || 0;
      acc.minor += page.summary?.minor || 0;
      return acc;
    }, { critical: 0, serious: 0, moderate: 0, minor: 0 });
  }, [results]);

  const totalIssues = totals.critical + totals.serious + totals.moderate + totals.minor;

  // Flatten all issues with page info
  const allIssues = useMemo(() => {
    const issues: Array<ScanIssue & { pageUrl: string; pageTitle: string }> = [];
    results.forEach(page => {
      (page.issues || []).forEach(issue => {
        issues.push({
          ...issue,
          pageUrl: page.url,
          pageTitle: page.title
        });
      });
    });
    return issues;
  }, [results]);

  // Get unique pages
  const uniquePages = [...new Set(results.map(r => r.url))];

  // Get unique categories with counts
  const categoryCount: Record<string, number> = {};
  allIssues.forEach(issue => {
    const cat = getCategoryForIssue(issue.id);
    categoryCount[cat.name] = (categoryCount[cat.name] || 0) + 1;
  });
  const uniqueCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // Filter issues
  const filteredIssues = allIssues.filter(issue => {
    const matchesImpact = filterImpact === 'all' || issue.impact === filterImpact;
    const matchesPage = filterPage === 'all' || issue.pageUrl === filterPage;
    const matchesCategory = filterCategory === 'all' || getCategoryForIssue(issue.id).name === filterCategory;
    return matchesImpact && matchesPage && matchesCategory;
  });

  // Group issues by type
  const groupedIssues = useMemo(() => {
    const groups: Record<string, any> = {};
    filteredIssues.forEach(issue => {
      if (!groups[issue.id]) {
        groups[issue.id] = {
          id: issue.id,
          impact: issue.impact,
          description: issue.description,
          help: issue.help,
          helpUrl: issue.helpUrl,
          category: getCategoryForIssue(issue.id),
          instances: []
        };
      }
      groups[issue.id].instances.push(issue);
    });
    return Object.values(groups).sort((a: any, b: any) => {
      const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
      return (order[a.impact as keyof typeof order] || 4) - (order[b.impact as keyof typeof order] || 4);
    });
  }, [filteredIssues]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50 rounded-xl shadow-2xl max-w-7xl w-full my-4 max-h-[95vh] flex flex-col">
        
        {/* Header - GREEN like Real Scan */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-xl flex-shrink-0">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                🎯 Accessibility Scan Results
              </h1>
              <p className="text-green-100 mt-1">
                Scanned {results.length} pages • Found {totalIssues} issues
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 bg-green-800 text-white rounded-lg hover:bg-green-900 transition"
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        {metadata && (
          <div className="bg-green-100 border-b border-green-200 px-6 py-3 flex-shrink-0">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle size={18} />
              <span>
                Pre-scanned data • Scanned by <strong>{metadata.scannedBy}</strong> on{' '}
                <strong>{new Date(metadata.scanDate).toLocaleDateString('en-US', { 
                  month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                })}</strong>
                {' '}• <strong>{totalScannedInData}</strong> total pages in database
              </span>
            </div>
          </div>
        )}

        {/* Missing Pages Warning */}
        {missingPages.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex-shrink-0">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle size={18} />
              <span><strong>{missingPages.length}</strong> selected page(s) not in database. Use "Real Scan" for those.</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
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
                🐛 Issues ({totalIssues})
              </button>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-b-lg shadow-lg p-6">
              {activeTab === 'summary' ? (
                <>
                  {/* Summary Card */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                    <h3 className="font-bold text-blue-900 mb-4 text-xl">Summary</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <span className="text-gray-600">Pages Scanned:</span>
                        <span className="font-bold text-blue-600 ml-2 text-2xl">{results.length}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Total Issues:</span>
                        <span className="font-bold text-blue-600 ml-2 text-2xl">{totalIssues}</span>
                      </div>
                    </div>
                  </div>

                  {/* By Severity */}
                  <div className="mb-6">
                    <h3 className="font-bold text-gray-900 mb-4 text-xl">By Severity</h3>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-red-600">{totals.critical}</div>
                        <div className="text-sm text-red-700 mt-1">🔴 Critical</div>
                      </div>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-orange-600">{totals.serious}</div>
                        <div className="text-sm text-orange-700 mt-1">🟠 Serious</div>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-yellow-600">{totals.moderate}</div>
                        <div className="text-sm text-yellow-700 mt-1">🟡 Moderate</div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-blue-600">{totals.minor}</div>
                        <div className="text-sm text-blue-700 mt-1">🔵 Minor</div>
                      </div>
                    </div>
                  </div>

                  {/* By Category */}
                  <div className="mb-6">
                    <h3 className="font-bold text-gray-900 mb-4 text-xl">By Category</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {uniqueCategories.map(({ name, count }) => {
                        const categoryInfo = Object.values(ISSUE_CATEGORIES).find(c => c.name === name) || { icon: '📌' };
                        return (
                          <div 
                            key={name} 
                            className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:bg-indigo-100 transition"
                            onClick={() => { setFilterCategory(name); setActiveTab('issues'); }}
                          >
                            <span className="text-2xl">{categoryInfo.icon}</span>
                            <div>
                              <div className="font-bold text-indigo-900">{count}</div>
                              <div className="text-xs text-indigo-700">{name}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Scanned Pages */}
                  <div className="mb-6">
                    <h3 className="font-bold text-gray-900 mb-4 text-xl">Scanned Pages</h3>
                    <div className="bg-gray-50 border rounded-lg p-4 max-h-64 overflow-y-auto">
                      {results.map((page, idx) => (
                        <div key={idx} className="flex items-center gap-2 py-2 border-b last:border-0">
                          <CheckCircle className="text-green-600" size={18} />
                          <span className="text-gray-700">{page.url}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Filters */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg border space-y-4">
                    {/* Category Filter */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Tag size={16} className="text-gray-600" />
                        <span className="text-gray-700 font-semibold">Filter by Category:</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setFilterCategory('all')}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            filterCategory === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          All Categories
                        </button>
                        {uniqueCategories.map(({ name, count }) => {
                          const categoryInfo = Object.values(ISSUE_CATEGORIES).find(c => c.name === name) || { icon: '📌' };
                          return (
                            <button
                              key={name}
                              onClick={() => setFilterCategory(name)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                                filterCategory === name ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {categoryInfo.icon} {name} ({count})
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Page Filter */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Filter size={16} className="text-gray-600" />
                        <span className="text-gray-700 font-semibold">Filter by Page:</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setFilterPage('all')}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            filterPage === 'all' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          All Pages
                        </button>
                        {uniquePages.map((pageUrl, idx) => {
                          const pageIssueCount = allIssues.filter(i => i.pageUrl === pageUrl).length;
                          return (
                            <button
                              key={idx}
                              onClick={() => setFilterPage(pageUrl)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                                filterPage === pageUrl ? 'bg-blue-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {getPageName(pageUrl)} ({pageIssueCount})
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
                              filterImpact === impact ? 'bg-blue-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {impact === 'all' ? 'All Severities' : getImpactBadge(impact)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Filter Status */}
                    <div className="pt-2 border-t text-sm text-gray-600">
                      Showing <strong>{filteredIssues.length}</strong> of <strong>{allIssues.length}</strong> issues
                      {filterCategory !== 'all' && <span className="ml-2 text-indigo-600">• Category: {filterCategory}</span>}
                      {filterPage !== 'all' && <span className="ml-2 text-blue-600">• Page: {getPageName(filterPage)}</span>}
                      {filterImpact !== 'all' && <span className="ml-2 text-orange-600">• Severity: {filterImpact}</span>}
                    </div>
                  </div>

                  {/* Issues List */}
                  {filteredIssues.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-lg">No issues match the current filters.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {groupedIssues.map((issueGroup: any, idx: number) => (
                        <div key={idx} className={`border-2 rounded-lg overflow-hidden ${getImpactColor(issueGroup.impact)}`}>
                          <div 
                            className="p-4 cursor-pointer flex justify-between items-start hover:bg-opacity-80 transition"
                            onClick={() => toggleIssue(idx)}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs font-medium">
                                  {issueGroup.category.icon} {issueGroup.category.name}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-bold ${getImpactColor(issueGroup.impact)}`}>
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
                              {expandedIssues.has(idx) ? <ChevronUp size={24} className="text-gray-500" /> : <ChevronDown size={24} className="text-gray-500" />}
                            </div>
                          </div>
                          
                          {expandedIssues.has(idx) && (
                            <div className="border-t bg-white p-4">
                              <p className="text-gray-600 mb-4">{issueGroup.description}</p>
                              
                              {issueGroup.helpUrl && (
                                <a href={issueGroup.helpUrl} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-blue-600 hover:underline mb-4 font-medium">
                                  <ExternalLink size={16} /> Learn more about this issue
                                </a>
                              )}

                              <h5 className="font-semibold text-gray-800 mb-3 text-lg">Affected Elements:</h5>
                              <div className="space-y-3 max-h-96 overflow-y-auto">
                                {issueGroup.instances.map((instance: any, iIdx: number) => (
                                  <div key={iIdx} className="bg-gray-50 rounded-lg p-4 border">
                                    {instance.pageUrl && (
                                      <div className="text-sm text-blue-600 mb-2 font-medium">📄 {instance.pageUrl}</div>
                                    )}
                                    {instance.nodes && instance.nodes[0] && (
                                      <>
                                        <div className="text-xs text-gray-500 mb-2">
                                          <strong>Selector:</strong> {Array.isArray(instance.nodes[0].target) ? instance.nodes[0].target.join(' > ') : instance.nodes[0].target}
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
              <p className="mt-1">WCAG 2.1 Level AA • Powered by axe-core + Playwright</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}