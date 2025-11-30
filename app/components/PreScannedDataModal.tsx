// app/components/PreScannedDataModal.tsx
// Enhanced modal to display pre-scanned data with filters like the scan-results page

'use client';

import { useState, useMemo } from 'react';
import { X, ChevronDown, ChevronUp, ExternalLink, Download, Calendar, User, FileText, Filter, Tag, AlertTriangle } from 'lucide-react';

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
  note?: string;
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
const ISSUE_CATEGORIES: Record<string, { name: string; icon: string; description: string }> = {
  'color-contrast': { name: 'Color Contrast', icon: '🎨', description: 'Text and background color contrast issues' },
  'image-alt': { name: 'Image Alt Text', icon: '🖼️', description: 'Missing or improper image descriptions' },
  'input-image-alt': { name: 'Image Alt Text', icon: '🖼️', description: 'Missing or improper image descriptions' },
  'label': { name: 'Form Labels', icon: '📝', description: 'Form inputs without proper labels' },
  'label-title-only': { name: 'Form Labels', icon: '📝', description: 'Form field label issues' },
  'form-field-multiple-labels': { name: 'Form Labels', icon: '📝', description: 'Form field label issues' },
  'select-name': { name: 'Form Labels', icon: '📝', description: 'Select elements need accessible names' },
  'button-name': { name: 'Button/Link Names', icon: '🔘', description: 'Buttons without accessible names' },
  'link-name': { name: 'Button/Link Names', icon: '🔗', description: 'Links without accessible names' },
  'link-in-text-block': { name: 'Button/Link Names', icon: '🔗', description: 'Links must be distinguishable' },
  'aria-allowed-attr': { name: 'ARIA Attributes', icon: '♿', description: 'ARIA attribute issues' },
  'aria-hidden-body': { name: 'ARIA Attributes', icon: '♿', description: 'ARIA hidden on body' },
  'aria-hidden-focus': { name: 'ARIA Attributes', icon: '♿', description: 'ARIA hidden with focusable elements' },
  'aria-required-attr': { name: 'ARIA Attributes', icon: '♿', description: 'Missing required ARIA attributes' },
  'aria-required-children': { name: 'ARIA Attributes', icon: '♿', description: 'Missing required ARIA children' },
  'aria-required-parent': { name: 'ARIA Attributes', icon: '♿', description: 'Missing required ARIA parent' },
  'aria-roles': { name: 'ARIA Attributes', icon: '♿', description: 'Invalid ARIA roles' },
  'aria-valid-attr': { name: 'ARIA Attributes', icon: '♿', description: 'Invalid ARIA attributes' },
  'aria-valid-attr-value': { name: 'ARIA Attributes', icon: '♿', description: 'Invalid ARIA attribute values' },
  'heading-order': { name: 'Heading Structure', icon: '📑', description: 'Heading levels should increase by one' },
  'empty-heading': { name: 'Heading Structure', icon: '📑', description: 'Empty heading elements' },
  'page-has-heading-one': { name: 'Heading Structure', icon: '📑', description: 'Page should have h1' },
  'focus-order-semantics': { name: 'Keyboard/Focus', icon: '⌨️', description: 'Focus order issues' },
  'tabindex': { name: 'Keyboard/Focus', icon: '⌨️', description: 'Tab index issues' },
  'accesskeys': { name: 'Keyboard/Focus', icon: '⌨️', description: 'Access key issues' },
  'landmark-one-main': { name: 'Landmarks', icon: '🗺️', description: 'Page should have main landmark' },
  'region': { name: 'Landmarks', icon: '🗺️', description: 'Content should be in landmarks' },
  'bypass': { name: 'Landmarks', icon: '🗺️', description: 'Skip navigation links' },
  'duplicate-id': { name: 'HTML Validity', icon: '🔧', description: 'Duplicate ID attributes' },
  'duplicate-id-active': { name: 'HTML Validity', icon: '🔧', description: 'Duplicate ID on active elements' },
  'duplicate-id-aria': { name: 'HTML Validity', icon: '🔧', description: 'Duplicate ID for ARIA' },
  'meta-viewport': { name: 'Zoom/Scaling', icon: '🔍', description: 'Viewport zoom issues' },
  'html-has-lang': { name: 'Page Structure', icon: '🌐', description: 'HTML language attribute' },
  'html-lang-valid': { name: 'Page Structure', icon: '🌐', description: 'Valid language code' },
  'document-title': { name: 'Page Structure', icon: '📄', description: 'Page title missing' },
};

function getCategoryForIssue(issueId: string): { name: string; icon: string } {
  const category = ISSUE_CATEGORIES[issueId];
  if (category) {
    return { name: category.name, icon: category.icon };
  }
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

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
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
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterPage, setFilterPage] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());

  // Calculate totals
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
      page.issues.forEach(issue => {
        issues.push({
          ...issue,
          pageUrl: page.url,
          pageTitle: page.title
        });
      });
    });
    return issues;
  }, [results]);

  // Get unique categories with counts
  const categoryCount = useMemo(() => {
    const counts: Record<string, number> = {};
    allIssues.forEach(issue => {
      const cat = getCategoryForIssue(issue.id);
      counts[cat.name] = (counts[cat.name] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [allIssues]);

  // Get unique pages with counts
  const pageCount = useMemo(() => {
    const counts: Record<string, { title: string; count: number }> = {};
    results.forEach(page => {
      const issueCount = page.issues.length;
      counts[page.url] = { title: page.title, count: issueCount };
    });
    return counts;
  }, [results]);

  // Filter issues
  const filteredIssues = useMemo(() => {
    return allIssues.filter(issue => {
      const matchesSeverity = filterSeverity === 'all' || issue.impact === filterSeverity;
      const matchesPage = filterPage === 'all' || issue.pageUrl === filterPage;
      const matchesCategory = filterCategory === 'all' || getCategoryForIssue(issue.id).name === filterCategory;
      return matchesSeverity && matchesPage && matchesCategory;
    });
  }, [allIssues, filterSeverity, filterPage, filterCategory]);

  // Group filtered issues by type
  const groupedIssues = useMemo(() => {
    const groups: Record<string, {
      id: string;
      impact: string;
      description: string;
      help: string;
      helpUrl: string;
      category: { name: string; icon: string };
      instances: Array<ScanIssue & { pageUrl: string; pageTitle: string }>;
    }> = {};

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

    return Object.values(groups).sort((a, b) => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full my-4 max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-xl flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-lg">
                <FileText size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Latest Scan Data</h2>
                <p className="text-purple-200">Pre-scanned accessibility results</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Metadata Bar */}
        {metadata && (
          <div className="bg-gray-50 border-b px-6 py-4 flex-shrink-0">
            <div className="flex flex-wrap gap-6 items-center">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500">SCAN DATE</div>
                  <div className="font-semibold text-gray-900">{formatDate(metadata.scanDate)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User size={18} className="text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500">SCANNED BY</div>
                  <div className="font-semibold text-gray-900">{metadata.scannedBy}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500">SHOWING</div>
                  <div className="font-semibold text-gray-900">
                    {results.length} of {results.length} selected 
                    <span className="text-gray-500 font-normal"> ({totalScannedInData} total scanned)</span>
                  </div>
                </div>
              </div>
            </div>
            {metadata.note && (
              <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
                <span>📋</span> {metadata.note}
              </div>
            )}
          </div>
        )}

        {/* Missing Pages Warning */}
        {missingPages.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex-shrink-0">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-amber-800 font-semibold">
                  {missingPages.length} page(s) not in pre-scanned data
                </p>
                <p className="text-amber-700 text-sm mt-1">
                  These pages haven't been scanned yet. Use "Real Scan" to scan them.
                </p>
                <div className="mt-2 text-sm text-amber-700">
                  {missingPages.slice(0, 3).map((url, idx) => (
                    <div key={idx}>• {url}</div>
                  ))}
                  {missingPages.length > 3 && (
                    <div>...and {missingPages.length - 3} more</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {results.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-semibold">No matching scan data found</p>
              <p className="text-sm mt-2">Run a "Real Scan" to generate accessibility data for these pages.</p>
            </div>
          ) : (
            <>
              {/* Severity Summary Cards */}
              <div className="grid grid-cols-5 gap-3 mb-6">
                <div className="bg-gray-50 border rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">{totalIssues}</div>
                  <div className="text-xs text-gray-600">TOTAL ISSUES</div>
                </div>
                <button
                  onClick={() => { setFilterSeverity(filterSeverity === 'critical' ? 'all' : 'critical'); setActiveTab('issues'); }}
                  className={`border rounded-lg p-4 text-center transition hover:shadow ${filterSeverity === 'critical' ? 'ring-2 ring-red-500 bg-red-50' : 'bg-red-50'}`}
                >
                  <div className="text-2xl font-bold text-red-600">{totals.critical}</div>
                  <div className="text-xs text-red-700">CRITICAL</div>
                </button>
                <button
                  onClick={() => { setFilterSeverity(filterSeverity === 'serious' ? 'all' : 'serious'); setActiveTab('issues'); }}
                  className={`border rounded-lg p-4 text-center transition hover:shadow ${filterSeverity === 'serious' ? 'ring-2 ring-orange-500 bg-orange-50' : 'bg-orange-50'}`}
                >
                  <div className="text-2xl font-bold text-orange-600">{totals.serious}</div>
                  <div className="text-xs text-orange-700">SERIOUS</div>
                </button>
                <button
                  onClick={() => { setFilterSeverity(filterSeverity === 'moderate' ? 'all' : 'moderate'); setActiveTab('issues'); }}
                  className={`border rounded-lg p-4 text-center transition hover:shadow ${filterSeverity === 'moderate' ? 'ring-2 ring-yellow-500 bg-yellow-50' : 'bg-yellow-50'}`}
                >
                  <div className="text-2xl font-bold text-yellow-600">{totals.moderate}</div>
                  <div className="text-xs text-yellow-700">MODERATE</div>
                </button>
                <button
                  onClick={() => { setFilterSeverity(filterSeverity === 'minor' ? 'all' : 'minor'); setActiveTab('issues'); }}
                  className={`border rounded-lg p-4 text-center transition hover:shadow ${filterSeverity === 'minor' ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-blue-50'}`}
                >
                  <div className="text-2xl font-bold text-blue-600">{totals.minor}</div>
                  <div className="text-xs text-blue-700">MINOR</div>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b mb-6">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`px-6 py-3 font-semibold transition ${
                    activeTab === 'summary' 
                      ? 'text-purple-600 border-b-2 border-purple-600' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  📊 Summary
                </button>
                <button
                  onClick={() => setActiveTab('issues')}
                  className={`px-6 py-3 font-semibold transition ${
                    activeTab === 'issues' 
                      ? 'text-purple-600 border-b-2 border-purple-600' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  🐛 Issues ({totalIssues})
                </button>
              </div>

              {activeTab === 'summary' ? (
                <>
                  {/* Summary Stats */}
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

                  {/* By Category */}
                  <div className="mb-6">
                    <h3 className="font-bold text-gray-900 mb-4 text-xl">By Category</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {categoryCount.map(({ name, count }) => {
                        const cat = Object.values(ISSUE_CATEGORIES).find(c => c.name === name) || { icon: '📌' };
                        return (
                          <button
                            key={name}
                            onClick={() => { setFilterCategory(name); setActiveTab('issues'); }}
                            className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center gap-3 hover:bg-indigo-100 transition text-left"
                          >
                            <span className="text-2xl">{cat.icon}</span>
                            <div>
                              <div className="font-bold text-indigo-900">{count}</div>
                              <div className="text-xs text-indigo-700">{name}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pages with Issues */}
                  <div className="mb-6">
                    <h3 className="font-bold text-gray-900 mb-4 text-xl">Pages</h3>
                    <div className="space-y-2">
                      {results.map((page, idx) => {
                        const issueCount = page.issues.length;
                        return (
                          <button
                            key={idx}
                            onClick={() => { setFilterPage(page.url); setActiveTab('issues'); }}
                            className="w-full text-left bg-gray-50 hover:bg-gray-100 border rounded-lg p-4 flex justify-between items-center transition"
                          >
                            <div>
                              <div className="font-semibold text-gray-900">{page.title}</div>
                              <div className="text-sm text-gray-500">{page.url}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {page.summary.critical > 0 && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                                  {page.summary.critical} critical
                                </span>
                              )}
                              {page.summary.serious > 0 && (
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                                  {page.summary.serious} serious
                                </span>
                              )}
                              {page.summary.moderate > 0 && (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                                  {page.summary.moderate} moderate
                                </span>
                              )}
                              <span className="px-3 py-1 bg-gray-200 rounded-full text-sm font-medium">
                                {issueCount} total
                              </span>
                            </div>
                          </button>
                        );
                      })}
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
                            filterCategory === 'all'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white border text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          All Categories
                        </button>
                        {categoryCount.map(({ name, count }) => {
                          const cat = Object.values(ISSUE_CATEGORIES).find(c => c.name === name) || { icon: '📌' };
                          return (
                            <button
                              key={name}
                              onClick={() => setFilterCategory(name)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                                filterCategory === name
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-white border text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {cat.icon} {name} ({count})
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
                            filterPage === 'all'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          All Pages
                        </button>
                        {Object.entries(pageCount).map(([url, { title, count }]) => (
                          <button
                            key={url}
                            onClick={() => setFilterPage(url)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                              filterPage === url
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {getPageName(url)} ({count})
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Severity Filter */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-gray-700 font-semibold">Filter by Severity:</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setFilterSeverity('all')}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            filterSeverity === 'all'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          All Severities
                        </button>
                        {['critical', 'serious', 'moderate', 'minor'].map(severity => (
                          <button
                            key={severity}
                            onClick={() => setFilterSeverity(severity)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                              filterSeverity === severity
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {severity === 'critical' ? '🔴' : severity === 'serious' ? '🟠' : severity === 'moderate' ? '🟡' : '🔵'} {severity.charAt(0).toUpperCase() + severity.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Filter Status */}
                    <div className="pt-2 border-t text-sm text-gray-600">
                      Showing <strong>{filteredIssues.length}</strong> of <strong>{totalIssues}</strong> issues
                      {filterCategory !== 'all' && <span className="ml-2 text-indigo-600">• Category: {filterCategory}</span>}
                      {filterPage !== 'all' && <span className="ml-2 text-blue-600">• Page: {getPageName(filterPage)}</span>}
                      {filterSeverity !== 'all' && <span className="ml-2 text-orange-600">• Severity: {filterSeverity}</span>}
                      {(filterCategory !== 'all' || filterPage !== 'all' || filterSeverity !== 'all') && (
                        <button 
                          onClick={() => { setFilterCategory('all'); setFilterPage('all'); setFilterSeverity('all'); }}
                          className="ml-4 text-purple-600 hover:underline"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Issues List */}
                  {filteredIssues.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-lg">No issues match the current filters.</p>
                      <button 
                        onClick={() => { setFilterCategory('all'); setFilterPage('all'); setFilterSeverity('all'); }}
                        className="mt-2 text-purple-600 hover:underline"
                      >
                        Clear all filters
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {groupedIssues.map((group, idx) => (
                        <div 
                          key={idx} 
                          className={`border-2 rounded-lg overflow-hidden ${getImpactColor(group.impact)}`}
                        >
                          <div 
                            className="p-4 cursor-pointer flex justify-between items-start hover:bg-opacity-80 transition"
                            onClick={() => toggleIssue(idx)}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs font-medium">
                                  {group.category.icon} {group.category.name}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-bold ${getImpactColor(group.impact)}`}>
                                  {group.impact === 'critical' ? '🔴 Critical' : group.impact === 'serious' ? '🟠 Serious' : group.impact === 'moderate' ? '🟡 Moderate' : '🔵 Minor'}
                                </span>
                                <span className="text-gray-600 text-sm font-medium">
                                  {group.instances.length} instance(s)
                                </span>
                              </div>
                              <h4 className="font-bold text-gray-900 text-lg">{group.id}</h4>
                              <p className="text-gray-700 mt-1">{group.help}</p>
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
                              <p className="text-gray-600 mb-4">{group.description}</p>
                              
                              {group.helpUrl && (
                                <a 
                                  href={group.helpUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-blue-600 hover:underline mb-4 font-medium"
                                >
                                  <ExternalLink size={16} />
                                  Learn more about this issue
                                </a>
                              )}

                              <h5 className="font-semibold text-gray-800 mb-3">Affected Elements:</h5>
                              <div className="space-y-3 max-h-96 overflow-y-auto">
                                {group.instances.map((instance, iIdx) => (
                                  <div key={iIdx} className="bg-gray-50 rounded-lg p-4 border">
                                    <div className="text-sm text-blue-600 mb-2 font-medium">
                                      📄 {instance.pageTitle} - {instance.pageUrl}
                                    </div>
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 rounded-b-xl flex justify-between items-center flex-shrink-0">
          <p className="text-sm text-gray-500">
            {totalIssues} issues found across {results.length} pages
          </p>
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