'use client';

import { useState, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, ChevronDown, ChevronUp, ExternalLink, CheckCircle, Filter, Tag } from 'lucide-react';

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

// Category mapping based on axe-core rule IDs
const ISSUE_CATEGORIES: Record<string, { name: string; icon: string; description: string }> = {
  'color-contrast': { name: 'Color Contrast', icon: '🎨', description: 'Text and background color contrast issues' },
  'image-alt': { name: 'Image Alt Text', icon: '🖼️', description: 'Missing or improper image descriptions' },
  'input-image-alt': { name: 'Image Alt Text', icon: '🖼️', description: 'Missing or improper image descriptions' },
  'label': { name: 'Form Labels', icon: '📝', description: 'Form inputs without proper labels' },
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
  'focus-visible': { name: 'Focus Indicators', icon: '👁️', description: 'Focus must be visible' },
  'listitem': { name: 'List Structure', icon: '📋', description: 'List items must be in proper lists' },
  'list': { name: 'List Structure', icon: '📋', description: 'List structure issues' },
  'definition-list': { name: 'List Structure', icon: '📋', description: 'Definition list issues' },
  'table-fake-caption': { name: 'Table Structure', icon: '📊', description: 'Table caption issues' },
  'td-headers-attr': { name: 'Table Structure', icon: '📊', description: 'Table header issues' },
  'th-has-data-cells': { name: 'Table Structure', icon: '📊', description: 'Table header cells' },
  'document-title': { name: 'Page Structure', icon: '📄', description: 'Page title missing' },
  'html-has-lang': { name: 'Page Structure', icon: '🌐', description: 'HTML language attribute' },
  'html-lang-valid': { name: 'Page Structure', icon: '🌐', description: 'Valid language code' },
  'landmark-one-main': { name: 'Landmarks', icon: '🗺️', description: 'Page should have main landmark' },
  'region': { name: 'Landmarks', icon: '🗺️', description: 'Content should be in landmarks' },
  'bypass': { name: 'Landmarks', icon: '🗺️', description: 'Skip navigation links' },
  'duplicate-id': { name: 'HTML Validity', icon: '🔧', description: 'Duplicate ID attributes' },
  'duplicate-id-active': { name: 'HTML Validity', icon: '🔧', description: 'Duplicate ID on active elements' },
  'duplicate-id-aria': { name: 'HTML Validity', icon: '🔧', description: 'Duplicate ID for ARIA' },
  'video-caption': { name: 'Media', icon: '🎬', description: 'Video needs captions' },
  'audio-caption': { name: 'Media', icon: '🎵', description: 'Audio needs captions' },
  'frame-title': { name: 'Frames', icon: '🖼️', description: 'Frames need titles' },
  'frame-focusable-content': { name: 'Frames', icon: '🖼️', description: 'Frame focusable content' },
  'meta-viewport': { name: 'Zoom/Scaling', icon: '🔍', description: 'Viewport zoom issues' },
  'meta-refresh': { name: 'Timing', icon: '⏱️', description: 'Auto-refresh issues' },
  'blink': { name: 'Animations', icon: '✨', description: 'Blinking content' },
  'marquee': { name: 'Animations', icon: '✨', description: 'Marquee elements' },
};

// Get category for an issue
function getCategoryForIssue(issueId: string): { name: string; icon: string } {
  const category = ISSUE_CATEGORIES[issueId];
  if (category) {
    return { name: category.name, icon: category.icon };
  }
  // Default category based on common patterns
  if (issueId.startsWith('aria-')) return { name: 'ARIA Attributes', icon: '♿' };
  if (issueId.includes('color') || issueId.includes('contrast')) return { name: 'Color Contrast', icon: '🎨' };
  if (issueId.includes('label') || issueId.includes('form')) return { name: 'Form Labels', icon: '📝' };
  if (issueId.includes('button') || issueId.includes('link')) return { name: 'Button/Link Names', icon: '🔗' };
  if (issueId.includes('heading')) return { name: 'Heading Structure', icon: '📑' };
  if (issueId.includes('focus') || issueId.includes('keyboard')) return { name: 'Keyboard/Focus', icon: '⌨️' };
  if (issueId.includes('image') || issueId.includes('alt')) return { name: 'Image Alt Text', icon: '🖼️' };
  if (issueId.includes('table')) return { name: 'Table Structure', icon: '📊' };
  if (issueId.includes('list')) return { name: 'List Structure', icon: '📋' };
  return { name: 'Other', icon: '📌' };
}

export default function ScanResultsPage() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'issues'>('summary');
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());
  const [filterImpact, setFilterImpact] = useState<string>('all');
  const [filterPage, setFilterPage] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
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

  // Get unique categories from issues
  const categoryCount: Record<string, number> = {};
  (result.issues || []).forEach(issue => {
    const cat = getCategoryForIssue(issue.id);
    categoryCount[cat.name] = (categoryCount[cat.name] || 0) + 1;
  });
  const uniqueCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // Filter issues by page, severity, AND category
  const filteredIssues = (result.issues || []).filter(issue => {
    const matchesImpact = filterImpact === 'all' || issue.impact === filterImpact;
    const matchesPage = filterPage === 'all' || issue.pageUrl === filterPage;
    const matchesCategory = filterCategory === 'all' || getCategoryForIssue(issue.id).name === filterCategory;
    return matchesImpact && matchesPage && matchesCategory;
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
        category: getCategoryForIssue(issue.id),
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
      const htmlContent = generateWordHTML(result, filteredIssues);
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
      const csvContent = generateExcelCSV(result, result.issues || []);
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
    const escapeHtml = (text: string) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };
    
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
    .summary-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .issue-card { border: 1px solid #e5e7eb; margin: 15px 0; padding: 15px; border-radius: 8px; }
    .code-block { background: #1f2937; color: #10b981; padding: 10px; font-family: monospace; font-size: 12px; overflow-x: auto; border-radius: 4px; margin: 10px 0; }
    .category-tag { background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>♿ Accessibility Audit Report</h1>
  <p><strong>Generated:</strong> ${date}</p>
  <p><strong>Tool:</strong> axe-core via Playwright</p>
  
  <div class="summary-box">
    <h2>📊 Summary</h2>
    <p><strong>Pages Scanned:</strong> ${result.totalScanned}</p>
    <p><strong>Total Issues:</strong> ${result.totalIssues}</p>
    <p><strong>Critical:</strong> ${result.criticalCount} | <strong>Serious:</strong> ${result.seriousCount} | <strong>Moderate:</strong> ${result.moderateCount} | <strong>Minor:</strong> ${result.minorCount}</p>
  </div>

  <h2>🐛 Issues by Category</h2>
  ${issues.map(issue => {
    const category = getCategoryForIssue(issue.id);
    return `
  <div class="issue-card">
    <span class="category-tag">${category.icon} ${category.name}</span>
    <span style="margin-left: 10px;">${getImpactBadge(issue.impact)}</span>
    <h3>${issue.id}</h3>
    <p><strong>${issue.help}</strong></p>
    <p>${issue.description}</p>
    ${issue.pageUrl ? `<p>📄 Page: ${issue.pageUrl}</p>` : ''}
    ${issue.nodes && issue.nodes[0] ? `
    <p><strong>Selector:</strong> ${issue.nodes[0].target?.join(' > ')}</p>
    <div class="code-block">${escapeHtml(issue.nodes[0].html)}</div>
    ` : ''}
  </div>
  `;
  }).join('\n')}
</body>
</html>
    `;
  };

  // Generate Excel CSV
  const generateExcelCSV = (result: ScanResult, issues: Issue[]) => {
    const headers = [
      'Category',
      'Issue ID',
      'Severity',
      'Description',
      'Help Text',
      'Page URL',
      'CSS Selector',
      'HTML Element',
      'Fix Suggestion',
      'Learn More URL'
    ];

    const rows = issues.map(issue => {
      const category = getCategoryForIssue(issue.id);
      return [
        category.name,
        issue.id,
        issue.impact,
        `"${(issue.description || '').replace(/"/g, '""')}"`,
        `"${(issue.help || '').replace(/"/g, '""')}"`,
        issue.pageUrl || '',
        `"${(issue.nodes?.[0]?.target?.join(' > ') || '').replace(/"/g, '""')}"`,
        `"${(issue.nodes?.[0]?.html || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${(issue.nodes?.[0]?.failureSummary || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        issue.helpUrl || ''
      ];
    });

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
      ['ISSUES BY CATEGORY'],
      ...Object.entries(categoryCount).map(([cat, count]) => [`${cat},${count}`]),
      [''],
      ['DETAILED ISSUES'],
      headers
    ];

    return [...summaryRows.map(row => row.join(',')), ...rows.map(row => row.join(','))].join('\n');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              🎯 Accessibility Scan Results
            </h1>
            <p className="text-green-100 mt-1">
              Scanned {result.totalScanned} pages • Found {result.totalIssues} issues
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
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
                <h3 className="font-bold text-gray-900 mb-4 text-xl">By Severity</h3>
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

              {/* Issues by Category - NEW! */}
              <div className="mb-6">
                <h3 className="font-bold text-gray-900 mb-4 text-xl">By Category</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {uniqueCategories.map(({ name, count }) => {
                    const categoryInfo = Object.values(ISSUE_CATEGORIES).find(c => c.name === name) || { icon: '📌' };
                    return (
                      <div 
                        key={name} 
                        className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:bg-indigo-100 transition"
                        onClick={() => {
                          setFilterCategory(name);
                          setActiveTab('issues');
                        }}
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
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border space-y-4">
                
                {/* Category Filter - NEW! */}
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
                    {uniqueCategories.map(({ name, count }) => {
                      const categoryInfo = Object.values(ISSUE_CATEGORIES).find(c => c.name === name) || { icon: '📌' };
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
                        filterPage === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      All Pages
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
                <div className="pt-2 border-t text-sm text-gray-600">
                  Showing <strong>{filteredIssues.length}</strong> of <strong>{result.issues?.length || 0}</strong> issues
                  {filterCategory !== 'all' && <span className="ml-2 text-indigo-600">• Category: {filterCategory}</span>}
                  {filterPage !== 'all' && <span className="ml-2 text-blue-600">• Page: {getPageName(filterPage)}</span>}
                  {filterImpact !== 'all' && <span className="ml-2 text-orange-600">• Severity: {filterImpact}</span>}
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
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            {/* Category Badge - NEW! */}
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
          <p className="mt-1">WCAG 2.1 Level AA • Powered by axe-core + Playwright</p>
        </div>
      </div>
    </div>
  );
}