'use client';

import { useState, useEffect } from 'react';
import SiteSelector from './components/SiteSelector';
import StatusCheckPage from './components/StatusCheckPage';
import { Site, triggerGitHubAction, fetchSites } from './components/DataService';
import { AuditPageResult, auditManager, AuditRun } from './components/AuditService';
import { CheckCircle, AlertCircle, History, ExternalLink } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'audit' | 'status'>('audit');
  const [allSites, setAllSites] = useState<Site[]>([]);
  const [auditStatus, setAuditStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedSites, setSelectedSites] = useState<Site[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentAuditRun, setCurrentAuditRun] = useState<AuditRun | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [auditHistory, setAuditHistory] = useState<AuditRun[]>([]);
  
  // Real Scan state
  const [isRealScanRunning, setIsRealScanRunning] = useState(false);
  const [realScanMessage, setRealScanMessage] = useState('');

  const previousRun = auditManager.getPreviousRun();

  useEffect(() => {
    async function loadSites() {
      const sites = await fetchSites();
      setAllSites(sites);
    }
    loadSites();
  }, []);

  // Function to open Lighthouse results in a new browser tab
  function openResultsInNewTab(auditRun: AuditRun) {
    sessionStorage.setItem('auditResults', JSON.stringify(auditRun));
    window.open('/results', '_blank');
  }

  function loadHistory() {
    const history = auditManager.getHistory();
    setAuditHistory(history);
    setShowHistory(true);
  }

  // Lighthouse Score handler (Google PageSpeed API)
  async function handleSelectSites(sites: Site[], pageCount: number) {
    if (sites.length === 0) {
      alert('Please select at least one site');
      return;
    }

    setSelectedSites(sites);
    setAuditStatus('running');
    setStatusMessage(`Starting Lighthouse audit for ${sites.length} site(s) and ${pageCount} page(s)...`);
    setProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 20;
        });
      }, 500);

      const results: AuditPageResult[] = [];
      const totalPages = sites.reduce((sum, site) => sum + site.pages.length, 0);
      let completedPages = 0;

      for (const site of sites) {
        for (const page of site.pages) {
          setStatusMessage(`Auditing ${page.title}... (${completedPages + 1}/${totalPages})`);
          
          let lighthouseData = null;
          try {
            console.log(`🔍 Calling Lighthouse API for: ${page.url}`);
            const lighthouseResponse = await fetch('/api/lighthouse', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: page.url }),
            });

            if (lighthouseResponse.ok) {
              lighthouseData = await lighthouseResponse.json();
              console.log(`✅ Lighthouse success for: ${page.url}`, lighthouseData);
            } else {
              console.log(`⚠️ Lighthouse failed for ${page.url}, status: ${lighthouseResponse.status}`);
            }
          } catch (error) {
            console.log(`⚠️ Lighthouse error for ${page.url}:`, error);
          }

          const lighthouseScores = lighthouseData?.scores || {
            performance: 0,
            accessibility: lighthouseData?.accessibility || 0,
            bestPractices: 0,
            seo: 0,
          };

          const lighthouseAccessibilityIssues = lighthouseData?.accessibilityIssues || [];
          const summary = lighthouseData?.summary || null;

          results.push({
            url: page.url,
            title: page.title,
            status: 'success',
            issues: [],
            timestamp: Date.now(),
            lighthouseScores,
            lighthouseAccessibilityIssues,
            summary,
          });

          completedPages++;
          setProgress(Math.floor((completedPages / totalPages) * 100));
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      clearInterval(progressInterval);
      setProgress(100);

      const auditRun = auditManager.saveAuditRun(results, sites.length);
      setCurrentAuditRun(auditRun);
      setAuditStatus('success');
      setStatusMessage(`✅ Lighthouse audit completed! Scanned ${pageCount} pages.`);
      openResultsInNewTab(auditRun);

      try {
        await triggerGitHubAction(results.map(r => r.url));
      } catch (error) {
        console.log('GitHub Action trigger skipped');
      }
    } catch (error) {
      setAuditStatus('error');
      setStatusMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    }
  }

  // ✅ FIXED: Real Scan handler (n8n + Playwright + axe-core)
  // Now handles empty responses gracefully and provides better error messages
  async function handleRealScan(sites: Site[], pageCount: number) {
    if (sites.length === 0) {
      alert('Please select at least one site');
      return;
    }

    setIsRealScanRunning(true);
    setRealScanMessage(`🚀 Starting Real Scan for ${pageCount} pages...`);

    try {
      const n8nWebhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/accessibility-scan';
      
      console.log(`🔗 n8n Webhook URL: ${n8nWebhookUrl}`);
      
      // Collect ALL issues from all pages
      const allIssues: Array<{
        id: string;
        impact: string;
        description: string;
        help: string;
        helpUrl: string;
        tags: string[];
        nodes: Array<{ html: string; target: string[]; failureSummary: string }>;
        pageUrl: string;
        pageTitle: string;
      }> = [];
      
      const scannedFiles: string[] = [];
      const totalPages = sites.reduce((sum, site) => sum + site.pages.length, 0);
      let completedPages = 0;
      
      let criticalCount = 0;
      let seriousCount = 0;
      let moderateCount = 0;
      let minorCount = 0;

      for (const site of sites) {
        for (const page of site.pages) {
          setRealScanMessage(`🔍 Scanning ${page.title}... (${completedPages + 1}/${totalPages})`);

          try {
            console.log(`📤 Sending to n8n: ${page.url}`);
            
            const response = await fetch(n8nWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: page.url }),
            });

            console.log(`📡 n8n Response status: ${response.status}`);

            if (response.ok) {
              // ✅ FIX: Get response as text first, then parse
              const responseText = await response.text();
              console.log(`📄 n8n Response body (${responseText.length} chars):`, responseText.substring(0, 200));
              
              // Check if response is empty
              if (!responseText || responseText.trim() === '') {
                console.error(`❌ Empty response from n8n for ${page.url}`);
                console.error('⚠️ Your n8n workflow needs a "Respond to Webhook" node!');
                scannedFiles.push(`${page.title} (empty response - check n8n workflow)`);
                completedPages++;
                continue;
              }
              
              // Try to parse JSON
              let scanData;
              try {
                scanData = JSON.parse(responseText);
                console.log(`✅ Parsed n8n response:`, scanData);
              } catch (parseError) {
                console.error(`❌ Failed to parse n8n response as JSON:`, parseError);
                console.error(`Response was:`, responseText.substring(0, 500));
                scannedFiles.push(`${page.title} (invalid JSON response)`);
                completedPages++;
                continue;
              }
              
              // Process violations from axe-core
              const violations = scanData.violations || [];
              console.log(`📊 Found ${violations.length} violations for ${page.url}`);
              
              violations.forEach((v: any) => {
                // Count by severity
                if (v.impact === 'critical') criticalCount++;
                else if (v.impact === 'serious') seriousCount++;
                else if (v.impact === 'moderate') moderateCount++;
                else if (v.impact === 'minor') minorCount++;
                
                // Add to allIssues with page info
                allIssues.push({
                  id: v.id || 'unknown',
                  impact: v.impact || 'moderate',
                  description: v.description || '',
                  help: v.help || '',
                  helpUrl: v.helpUrl || '',
                  tags: v.tags || [],
                  nodes: (v.nodes || []).map((n: any) => ({
                    html: n.html || '',
                    target: Array.isArray(n.target) ? n.target : [n.target || ''],
                    failureSummary: n.failureSummary || ''
                  })),
                  pageUrl: page.url,
                  pageTitle: page.title
                });
              });
              
              scannedFiles.push(page.title);
              console.log(`✅ Scanned ${page.title}: ${violations.length} issues`);
            } else {
              const errorText = await response.text();
              console.error(`❌ n8n returned error ${response.status}: ${errorText.substring(0, 200)}`);
              scannedFiles.push(`${page.title} (error ${response.status})`);
            }
          } catch (error) {
            console.error(`❌ Error scanning ${page.url}:`, error);
            
            // Check if it's a network error (n8n not running)
            if (error instanceof TypeError && error.message.includes('fetch')) {
              setRealScanMessage(`❌ Cannot connect to n8n. Is it running at ${n8nWebhookUrl}?`);
              setIsRealScanRunning(false);
              return;
            }
            
            scannedFiles.push(`${page.title} (error)`);
          }

          completedPages++;
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // ✅ Create result in the format scan-results/page.tsx expects
      const scanResult = {
        success: true,
        totalScanned: completedPages,
        totalIssues: allIssues.length,
        criticalCount,
        seriousCount,
        moderateCount,
        minorCount,
        message: `✅ Scanned ${completedPages} pages, found ${allIssues.length} accessibility issues`,
        files: scannedFiles,
        timestamp: new Date().toISOString(),
        issues: allIssues  // ✅ This is what scan-results page needs!
      };

      // ✅ Save to localStorage (NOT sessionStorage) with key 'scanResults' (NOT 'auditResults')
      localStorage.setItem('scanResults', JSON.stringify(scanResult));
      
      console.log('📊 Scan complete:', scanResult);
      
      if (allIssues.length === 0 && completedPages > 0) {
        setRealScanMessage(`⚠️ Scanned ${completedPages} pages but found 0 issues. Check n8n workflow.`);
      } else {
        setRealScanMessage(`✅ ${scanResult.message} - Opening results...`);
      }
      
      // ✅ Open /scan-results (NOT /results)
      window.open('/scan-results', '_blank');

      setTimeout(() => {
        setRealScanMessage('');
      }, 5000);

    } catch (error) {
      console.error('❌ Real Scan failed:', error);
      setRealScanMessage(`❌ Real Scan Error: ${error instanceof Error ? error.message : 'Is n8n running locally?'}`);
    } finally {
      setIsRealScanRunning(false);
    }
  }

  return (
    <main className="min-h-screen p-4" style={{ background: 'linear-gradient(to bottom right, #eff6ff, #ffffff, #eff6ff)', color: '#0f172a' }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-12 text-center">
          <div className="inline-block mb-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
            🚀 UF College of Education
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-3">
            ♿ Accessibility Audit Dashboard
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Automated accessibility compliance checks for WCAG 2.1 Level AA standards across all UF websites
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 flex justify-between items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-6 py-2 rounded-lg font-semibold transition ${
                activeTab === 'audit'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              🔍 Audit
            </button>
            <button
              onClick={() => window.open('/status', '_blank')}
              className="px-6 py-2 rounded-lg font-semibold transition bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              📊 Status Check ↗
            </button>
          </div>
          <div className="flex gap-2">
            {currentAuditRun && (
              <button
                onClick={() => openResultsInNewTab(currentAuditRun)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
              >
                <ExternalLink size={20} />
                View Last Results
              </button>
            )}
            <button
              onClick={loadHistory}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition"
            >
              <History size={20} />
              View History
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'audit' ? (
          <>
            {auditStatus !== 'idle' && (
              <div
                className={`mb-8 p-6 rounded-lg border-l-4 ${
                  auditStatus === 'running'
                    ? 'bg-blue-50 border-blue-400'
                    : auditStatus === 'success'
                    ? 'bg-green-50 border-green-400'
                    : 'bg-red-50 border-red-400'
                }`}
              >
                <div className="flex items-start gap-4">
                  {auditStatus === 'running' && (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 flex-shrink-0 mt-1"></div>
                  )}
                  {auditStatus === 'success' && (
                    <CheckCircle className="text-green-600 flex-shrink-0 mt-1" size={24} />
                  )}
                  {auditStatus === 'error' && (
                    <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={24} />
                  )}
                  <div className="flex-1">
                    <p
                      className={`font-semibold ${
                        auditStatus === 'running'
                          ? 'text-blue-900'
                          : auditStatus === 'success'
                          ? 'text-green-900'
                          : 'text-red-900'
                      }`}
                    >
                      {statusMessage}
                    </p>
                    {auditStatus === 'running' && (
                      <div className="mt-4">
                        <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">{Math.floor(progress)}% complete</p>
                      </div>
                    )}
                    {auditStatus === 'success' && (
                      <p className="text-sm text-green-700 mt-2">
                        Results opened in a new tab.{' '}
                        <button 
                          onClick={() => currentAuditRun && openResultsInNewTab(currentAuditRun)} 
                          className="underline hover:no-underline"
                        >
                          Click here to view again
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* SiteSelector with ALL required props */}
            <SiteSelector 
              onSelectSites={handleSelectSites} 
              onRealScan={handleRealScan}
              isRealScanRunning={isRealScanRunning}
              realScanMessage={realScanMessage}
            />
          </>
        ) : (
          <StatusCheckPage sites={allSites} />
        )}

        {/* History Modal */}
        {showHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full my-8">
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-bold">Audit History</h2>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="text-white hover:bg-blue-800 p-2 rounded transition"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">
                {auditHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No audit history yet</div>
                ) : (
                  <div className="space-y-4">
                    {auditHistory.map((run, idx) => {
                      let criticalCount = 0, seriousCount = 0;
                      run.results.forEach(r => {
                        if (r.summary) {
                          criticalCount += r.summary.critical || 0;
                          seriousCount += r.summary.serious || 0;
                        } else if (r.lighthouseAccessibilityIssues) {
                          r.lighthouseAccessibilityIssues.forEach((issue: any) => {
                            if (issue.impact === 'critical') criticalCount++;
                            if (issue.impact === 'serious') seriousCount++;
                          });
                        }
                      });

                      const avgScore = run.results.length > 0
                        ? Math.round(run.results.reduce((acc, r) => acc + (r.lighthouseScores?.accessibility || 0), 0) / run.results.length)
                        : 0;

                      return (
                        <div key={run.id} className="border rounded-lg p-4 hover:shadow-md transition">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-bold text-gray-900">
                                {idx === 0 ? '📊 Latest Run' : idx === 1 ? '📈 Previous Run' : '📋 Earlier Run'}
                              </h3>
                              <p className="text-sm text-gray-600">{run.dateString}</p>
                            </div>
                            <button
                              onClick={() => {
                                openResultsInNewTab(run);
                                setShowHistory(false);
                              }}
                              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition flex items-center gap-2"
                            >
                              <ExternalLink size={16} />
                              View in New Tab
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-4">
                            <div className="bg-blue-50 p-3 rounded">
                              <div className="text-xl font-bold text-blue-600">{run.siteCount}</div>
                              <div className="text-xs text-gray-600">Sites</div>
                            </div>
                            <div className="bg-purple-50 p-3 rounded">
                              <div className="text-xl font-bold text-purple-600">{run.pageCount}</div>
                              <div className="text-xs text-gray-600">Pages</div>
                            </div>
                            <div className="bg-green-50 p-3 rounded">
                              <div className="text-xl font-bold text-green-600">{avgScore}</div>
                              <div className="text-xs text-gray-600">Avg Score</div>
                            </div>
                            <div className="bg-red-50 p-3 rounded">
                              <div className="text-xl font-bold text-red-600">{criticalCount + seriousCount}</div>
                              <div className="text-xs text-gray-600">Critical+Serious</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t p-4 bg-gray-50 rounded-b-lg">
                <button
                  onClick={() => setShowHistory(false)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 text-center text-sm text-gray-500 border-t pt-8">
          <p>UF College of Education | Accessibility Compliance Tool</p>
          <p className="mt-2">All audit results are saved locally in your browser</p>
        </div>
      </div>
    </main>
  );
}