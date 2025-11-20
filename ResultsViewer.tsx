'use client';

import { AlertCircle, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

interface Issue {
  type: 'error' | 'warning';
  code: string;
  message: string;
}

interface AuditResult {
  url: string;
  pageTitle?: string;
  status: 'success' | 'error';
  issues?: Issue[];
}

interface Props {
  results: AuditResult[];
  onClose: () => void;
}

export default function ResultsViewer({ results, onClose }: Props) {
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'error' | 'warning'>('all');

  const totalIssues = results.reduce((sum, r) => sum + (r.issues?.length || 0), 0);
  const errorCount = results.reduce((sum, r) => sum + (r.issues?.filter(i => i.type === 'error').length || 0), 0);
  const warningCount = results.reduce((sum, r) => sum + (r.issues?.filter(i => i.type === 'warning').length || 0), 0);

  function getFilteredIssues(issues: Issue[] = []) {
    if (filterType === 'all') return issues;
    return issues.filter(i => i.type === filterType);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Audit Results</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-red-50 p-4 rounded">
              <div className="text-3xl font-bold text-red-600">{errorCount}</div>
              <div className="text-sm text-gray-600">Errors</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded">
              <div className="text-3xl font-bold text-yellow-600">{warningCount}</div>
              <div className="text-sm text-gray-600">Warnings</div>
            </div>
            <div className="bg-blue-50 p-4 rounded">
              <div className="text-3xl font-bold text-blue-600">{totalIssues}</div>
              <div className="text-sm text-gray-600">Total Issues</div>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setFilterType('all')} className={`px-4 py-2 rounded ${filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>All</button>
            <button onClick={() => setFilterType('error')} className={`px-4 py-2 rounded ${filterType === 'error' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}>Errors</button>
            <button onClick={() => setFilterType('warning')} className={`px-4 py-2 rounded ${filterType === 'warning' ? 'bg-yellow-600 text-white' : 'bg-gray-200'}`}>Warnings</button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {results.map((result, idx) => {
            const filteredIssues = getFilteredIssues(result.issues);
            const isExpanded = expandedPage === result.url;

            return (
              <div key={idx} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-4 cursor-pointer hover:bg-gray-100" onClick={() => setExpandedPage(isExpanded ? null : result.url)}>
                  <div className="flex items-center gap-3">
                    {result.status === 'success' ? <CheckCircle className="text-green-600" /> : <AlertCircle className="text-red-600" />}
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{result.pageTitle}</div>
                      <div className="text-xs text-gray-600">{result.url}</div>
                    </div>
                    <div className="text-sm font-semibold">{filteredIssues.length} issues</div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t p-4 space-y-2">
                    {filteredIssues.map((issue, issueIdx) => (
                      <div key={issueIdx} className={`p-3 rounded ${issue.type === 'error' ? 'bg-red-50 border-l-4 border-red-400' : 'bg-yellow-50 border-l-4 border-yellow-400'}`}>
                        <div className="font-semibold text-sm">{issue.message}</div>
                        <div className="text-xs text-gray-600 mt-1">{issue.code}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}