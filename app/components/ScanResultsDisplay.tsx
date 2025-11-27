'use client';

import { useState } from 'react';
import { X, AlertTriangle, AlertCircle, Info, CheckCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

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

interface Props {
  result: ScanResult;
  onClose: () => void;
}

export default function ScanResultsDisplay({ result, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'summary' | 'issues'>('summary');
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());
  const [filterImpact, setFilterImpact] = useState<string>('all');

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

  const filteredIssues = (result.issues || []).filter(issue => 
    filterImpact === 'all' || issue.impact === filterImpact
  );

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            🎯 Scan Results
          </h2>
          <button onClick={onClose} className="text-white hover:bg-green-800 p-2 rounded transition">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'summary' 
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            📊 Summary
          </button>
          <button
            onClick={() => setActiveTab('issues')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'issues' 
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            🐛 Issues ({result.totalIssues})
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'summary' ? (
            <>
              {/* Summary Card */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-bold text-blue-900 mb-3">Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-600">Pages Scanned:</span>
                    <span className="font-bold text-blue-600 ml-2">{result.totalScanned}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Issues:</span>
                    <span className="font-bold text-blue-600 ml-2">{result.totalIssues}</span>
                  </div>
                </div>
              </div>

              {/* Issue Severity Breakdown */}
              <div className="mb-6">
                <h3 className="font-bold text-gray-900 mb-3">Issue Severity</h3>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-600">{result.criticalCount}</div>
                    <div className="text-xs text-red-700">🔴 Critical</div>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-orange-600">{result.seriousCount}</div>
                    <div className="text-xs text-orange-700">🟠 Serious</div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{result.moderateCount}</div>
                    <div className="text-xs text-yellow-700">🟡 Moderate</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{result.minorCount}</div>
                    <div className="text-xs text-blue-700">🔵 Minor</div>
                  </div>
                </div>
              </div>

              {/* Scanned Pages */}
              <div className="mb-6">
                <h3 className="font-bold text-gray-900 mb-3">Scanned Pages</h3>
                <div className="bg-gray-50 border rounded-lg p-4 max-h-48 overflow-y-auto">
                  {result.files.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 py-1">
                      <CheckCircle className="text-green-600" size={16} />
                      <span className="text-sm text-gray-700">{file}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Success Message */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-semibold">{result.message}</p>
                <p className="text-green-600 text-sm mt-1">
                  Timestamp: {new Date(result.timestamp).toLocaleString()}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Filter */}
              <div className="mb-4 flex gap-2 flex-wrap">
                <span className="text-gray-600 py-2">Filter:</span>
                {['all', 'critical', 'serious', 'moderate', 'minor'].map(impact => (
                  <button
                    key={impact}
                    onClick={() => setFilterImpact(impact)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                      filterImpact === impact
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {impact === 'all' ? 'All' : getImpactBadge(impact)}
                  </button>
                ))}
              </div>

              {/* Issues List */}
              {!result.issues || result.issues.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No detailed issues available.</p>
                  <p className="text-sm mt-2">Try running another scan to see issue details.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedIssues.map((issueGroup: any, idx: number) => (
                    <div 
                      key={idx} 
                      className={`border rounded-lg overflow-hidden ${getImpactColor(issueGroup.impact)}`}
                    >
                      <div 
                        className="p-4 cursor-pointer flex justify-between items-start"
                        onClick={() => toggleIssue(idx)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${getImpactColor(issueGroup.impact)}`}>
                              {getImpactBadge(issueGroup.impact)}
                            </span>
                            <span className="text-gray-500 text-sm">
                              {issueGroup.instances.length} instance(s)
                            </span>
                          </div>
                          <h4 className="font-bold text-gray-900">{issueGroup.id}</h4>
                          <p className="text-sm text-gray-700 mt-1">{issueGroup.help}</p>
                        </div>
                        <div className="ml-4">
                          {expandedIssues.has(idx) ? (
                            <ChevronUp size={20} className="text-gray-500" />
                          ) : (
                            <ChevronDown size={20} className="text-gray-500" />
                          )}
                        </div>
                      </div>
                      
                      {expandedIssues.has(idx) && (
                        <div className="border-t bg-white p-4">
                          <p className="text-sm text-gray-600 mb-3">{issueGroup.description}</p>
                          
                          {issueGroup.helpUrl && (
                            <a 
                              href={issueGroup.helpUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm mb-4"
                            >
                              <ExternalLink size={14} />
                              Learn more about this issue
                            </a>
                          )}

                          <h5 className="font-semibold text-gray-800 mb-2">Affected Elements:</h5>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {issueGroup.instances.map((instance: any, iIdx: number) => (
                              <div key={iIdx} className="bg-gray-50 rounded p-3 text-sm">
                                {instance.pageUrl && (
                                  <div className="text-xs text-blue-600 mb-1 truncate">
                                    📄 {instance.pageUrl}
                                  </div>
                                )}
                                {instance.nodes && instance.nodes[0] && (
                                  <>
                                    <div className="text-xs text-gray-500 mb-1">
                                      Selector: {instance.nodes[0].target?.join(' > ')}
                                    </div>
                                    <pre className="bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto">
                                      {instance.nodes[0].html}
                                    </pre>
                                    {instance.nodes[0].failureSummary && (
                                      <p className="text-xs text-red-600 mt-2">
                                        {instance.nodes[0].failureSummary}
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
        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}