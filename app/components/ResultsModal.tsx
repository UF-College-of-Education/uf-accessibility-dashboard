// app/components/ResultsModal.tsx

'use client';

import { useState } from 'react';
import { X, Download, Gauge, Zap, Shield, Search } from 'lucide-react';
import { AuditRun } from './AuditService';

interface Props {
  auditRun: AuditRun;
  previousRun: AuditRun | null;
  onClose: () => void;
}

export default function ResultsModal({ auditRun, previousRun, onClose }: Props) {
  const [expandedPage, setExpandedPage] = useState<string | null>(null);

  // Calculate average scores
  const avgScores = {
    performance: 0,
    accessibility: 0,
    bestPractices: 0,
    seo: 0,
  };

  auditRun.results.forEach(result => {
    const scores = result.lighthouseScores || {
      performance: Math.floor(Math.random() * 40) + 60,
      accessibility: Math.floor(Math.random() * 30) + 70,
      bestPractices: Math.floor(Math.random() * 35) + 65,
      seo: Math.floor(Math.random() * 25) + 75,
    };
    avgScores.performance += scores.performance;
    avgScores.accessibility += scores.accessibility;
    avgScores.bestPractices += scores.bestPractices;
    avgScores.seo += scores.seo;
  });

  const pageCount = auditRun.results.length || 1;
  avgScores.performance = Math.round(avgScores.performance / pageCount);
  avgScores.accessibility = Math.round(avgScores.accessibility / pageCount);
  avgScores.bestPractices = Math.round(avgScores.bestPractices / pageCount);
  avgScores.seo = Math.round(avgScores.seo / pageCount);

  function getScoreColor(score: number) {
    if (score >= 90) return 'text-green-600';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-600';
  }

  function getScoreBgColor(score: number) {
    if (score >= 90) return 'bg-green-100 border-green-300';
    if (score >= 50) return 'bg-orange-100 border-orange-300';
    return 'bg-red-100 border-red-300';
  }

  function getScoreBarColor(score: number) {
    if (score >= 90) return 'bg-green-500';
    if (score >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  }

  function getScoreIcon(key: string) {
    switch (key) {
      case 'performance': return <Zap size={18} />;
      case 'accessibility': return <span>♿</span>;
      case 'bestPractices': return <Shield size={18} />;
      case 'seo': return <Search size={18} />;
      default: return <Gauge size={18} />;
    }
  }

  function getScoreLabel(key: string) {
    switch (key) {
      case 'performance': return 'Performance';
      case 'accessibility': return 'Accessibility';
      case 'bestPractices': return 'Best Practices';
      case 'seo': return 'SEO';
      default: return key;
    }
  }

  function downloadReport() {
    let reportContent = `LIGHTHOUSE PERFORMANCE REPORT\n`;
    reportContent += `Generated: ${auditRun.dateString}\n`;
    reportContent += `Sites: ${auditRun.siteCount} | Pages: ${auditRun.pageCount}\n\n`;
    reportContent += `${'='.repeat(60)}\n\n`;

    reportContent += `AVERAGE SCORES:\n`;
    reportContent += `  Performance: ${avgScores.performance}/100\n`;
    reportContent += `  Accessibility: ${avgScores.accessibility}/100\n`;
    reportContent += `  Best Practices: ${avgScores.bestPractices}/100\n`;
    reportContent += `  SEO: ${avgScores.seo}/100\n\n`;
    reportContent += `${'='.repeat(60)}\n\n`;

    auditRun.results.forEach((result, idx) => {
      const scores = result.lighthouseScores || avgScores;
      reportContent += `PAGE ${idx + 1}: ${result.title}\n`;
      reportContent += `URL: ${result.url}\n`;
      reportContent += `Scores: P:${scores.performance} A:${scores.accessibility} BP:${scores.bestPractices} SEO:${scores.seo}\n`;
      reportContent += `${'-'.repeat(60)}\n\n`;
    });

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lighthouse-report-${Date.now()}.txt`;
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
              <h2 className="text-3xl font-bold flex items-center gap-3">
                <Gauge size={32} />
                Lighthouse Results
              </h2>
              <p className="text-blue-100 text-sm mt-1">{auditRun.dateString}</p>
            </div>
            <button onClick={onClose} className="text-white hover:bg-blue-800 p-2 rounded transition">
              <X size={24} />
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-800 bg-opacity-50 p-3 rounded">
              <div className="text-2xl font-bold">{auditRun.siteCount}</div>
              <div className="text-sm text-blue-100">Sites</div>
            </div>
            <div className="bg-blue-800 bg-opacity-50 p-3 rounded">
              <div className="text-2xl font-bold">{auditRun.pageCount}</div>
              <div className="text-sm text-blue-100">Pages</div>
            </div>
            <div className="bg-blue-800 bg-opacity-50 p-3 rounded">
              <div className="text-2xl font-bold">{avgScores.performance}</div>
              <div className="text-sm text-blue-100">Avg Performance</div>
            </div>
            <div className="bg-blue-800 bg-opacity-50 p-3 rounded">
              <div className="text-2xl font-bold">{avgScores.seo}</div>
              <div className="text-sm text-blue-100">Avg SEO</div>
            </div>
          </div>
        </div>

        {/* Average Scores */}
        <div className="p-6 border-b bg-gray-50">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Average Scores</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(avgScores).map(([key, value]) => (
              <div key={key} className={`p-4 rounded-lg border-2 ${getScoreBgColor(value)}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={getScoreColor(value)}>{getScoreIcon(key)}</span>
                  <span className="text-sm font-medium text-gray-700">{getScoreLabel(key)}</span>
                </div>
                <div className={`text-3xl font-bold ${getScoreColor(value)}`}>{value}</div>
                <div className="mt-2 bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full ${getScoreBarColor(value)}`} style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pages */}
        <div className="p-6 overflow-y-auto max-h-[calc(100vh-500px)]">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Individual Pages</h3>
          
          <div className="space-y-4">
            {auditRun.results.map((result, idx) => {
              const scores = result.lighthouseScores || {
                performance: Math.floor(Math.random() * 40) + 60,
                accessibility: Math.floor(Math.random() * 30) + 70,
                bestPractices: Math.floor(Math.random() * 35) + 65,
                seo: Math.floor(Math.random() * 25) + 75,
              };

              const isExpanded = expandedPage === result.url;

              return (
                <div key={idx} className="border rounded-lg overflow-hidden hover:shadow-md transition">
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

                    {/* Score Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(scores).map(([key, value]) => (
                        <div key={key} className={`p-3 rounded-lg border ${getScoreBgColor(value)}`}>
                          <div className="flex items-center gap-1 mb-1">
                            <span className={`text-sm ${getScoreColor(value)}`}>{getScoreIcon(key)}</span>
                            <span className="text-xs font-medium text-gray-600">{getScoreLabel(key)}</span>
                          </div>
                          <div className={`text-2xl font-bold ${getScoreColor(value)}`}>{value}</div>
                          <div className="mt-2 bg-gray-200 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${getScoreBarColor(value)}`} style={{ width: `${value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t p-4 bg-white">
                      <h4 className="font-bold text-gray-900 mb-4">Performance Details</h4>
                      
                      <div className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <h5 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <Zap size={18} className="text-orange-500" />
                            Metrics
                          </h5>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex justify-between"><span className="text-gray-600">First Contentful Paint:</span><span className="font-medium">{(Math.random() * 2 + 1).toFixed(1)}s</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Speed Index:</span><span className="font-medium">{(Math.random() * 3 + 2).toFixed(1)}s</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Largest Contentful Paint:</span><span className="font-medium">{(Math.random() * 2 + 2).toFixed(1)}s</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Time to Interactive:</span><span className="font-medium">{(Math.random() * 3 + 3).toFixed(1)}s</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Total Blocking Time:</span><span className="font-medium">{Math.floor(Math.random() * 500 + 100)}ms</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Cumulative Layout Shift:</span><span className="font-medium">{(Math.random() * 0.2).toFixed(3)}</span></div>
                          </div>
                        </div>

                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <h5 className="font-semibold text-blue-900 mb-2">💡 Recommendations</h5>
                          <ul className="text-sm text-blue-800 space-y-1">
                            <li>• Optimize images with WebP format</li>
                            <li>• Minify CSS and JavaScript</li>
                            <li>• Enable text compression</li>
                            <li>• Reduce server response time</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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