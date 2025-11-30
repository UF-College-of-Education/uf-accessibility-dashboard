// app/api/lighthouse/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface LighthouseResult {
  url: string;
  scores: {
    accessibility: number;
  };
  accessibilityIssues: Array<{
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
  summary: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    total: number;
    passed: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // ✅ GET THE API KEY FROM ENVIRONMENT
    const apiKey = process.env.PAGESPEED_API_KEY;
    
    if (!apiKey) {
      console.error('❌ PAGESPEED_API_KEY not found in environment variables');
      return NextResponse.json({ 
        error: 'API key not configured. Add PAGESPEED_API_KEY to .env.local' 
      }, { status: 500 });
    }

    console.log(`🔍 Starting Lighthouse Accessibility audit for: ${url}`);

    // ✅ ADD API KEY TO THE URL
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=ACCESSIBILITY&strategy=desktop&key=${apiKey}`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('PageSpeed API error:', errorData);
      throw new Error(`PageSpeed API failed: ${response.statusText}`);
    }

    const data = await response.json();
    const lhr = data.lighthouseResult;

    if (!lhr) {
      throw new Error('No Lighthouse result in PageSpeed response');
    }

    // Get accessibility score
    const accessibilityScore = Math.round((lhr.categories.accessibility?.score || 0) * 100);

    // Get all accessibility audits
    const accessibilityIssues: LighthouseResult['accessibilityIssues'] = [];
    let passedCount = 0;
    let criticalCount = 0;
    let seriousCount = 0;
    let moderateCount = 0;
    let minorCount = 0;

    // Known critical accessibility audits
    const CRITICAL_AUDITS = ['image-alt', 'button-name', 'link-name', 'label', 'document-title', 'html-has-lang', 'bypass', 'frame-title'];
    const SERIOUS_AUDITS = ['color-contrast', 'heading-order', 'list', 'listitem', 'aria-required-attr', 'aria-required-children', 'aria-required-parent', 'aria-roles', 'aria-valid-attr', 'aria-valid-attr-value', 'aria-allowed-attr'];

    // Process all audits in the accessibility category
    const auditRefs = lhr.categories.accessibility?.auditRefs || [];
    
    for (const auditRef of auditRefs) {
      const auditId = auditRef.id;
      const audit = lhr.audits[auditId];
      
      if (!audit) continue;
      
      // Skip manual and not applicable audits
      if (audit.scoreDisplayMode === 'manual' || audit.scoreDisplayMode === 'notApplicable') {
        continue;
      }

      // Check if passed (score === 1)
      if (audit.score === 1) {
        passedCount++;
        continue;
      }

      // This is a failed audit - determine impact
      let impact: 'critical' | 'serious' | 'moderate' | 'minor';
      
      if (CRITICAL_AUDITS.includes(auditId)) {
        impact = 'critical';
        criticalCount++;
      } else if (SERIOUS_AUDITS.includes(auditId)) {
        impact = 'serious';
        seriousCount++;
      } else if (audit.score === 0 || audit.score === null) {
        impact = 'serious';
        seriousCount++;
      } else if (audit.score < 0.5) {
        impact = 'moderate';
        moderateCount++;
      } else {
        impact = 'minor';
        minorCount++;
      }

      // Extract affected elements (limit to 5 per issue)
      const nodes: Array<{ html: string; target: string; failureSummary?: string }> = [];
      
      if (audit.details?.items) {
        for (const item of audit.details.items.slice(0, 5)) {
          nodes.push({
            html: item.node?.snippet || item.snippet || '',
            target: item.node?.selector || item.selector || '',
            failureSummary: item.node?.explanation || item.failureSummary || '',
          });
        }
      }

      accessibilityIssues.push({
        id: auditId,
        title: audit.title,
        description: audit.description,
        impact,
        score: audit.score,
        nodes,
      });
    }

    // Sort by severity
    const severityOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    accessibilityIssues.sort((a, b) => severityOrder[a.impact] - severityOrder[b.impact]);

    const result: LighthouseResult = {
      url,
      scores: {
        accessibility: accessibilityScore,
      },
      accessibilityIssues,
      summary: {
        critical: criticalCount,
        serious: seriousCount,
        moderate: moderateCount,
        minor: minorCount,
        total: criticalCount + seriousCount + moderateCount + minorCount,
        passed: passedCount,
      },
    };

    console.log(`✅ Lighthouse Accessibility audit completed: ${url} - Score: ${accessibilityScore}, Issues: ${result.summary.total}`);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('PageSpeed Insights error:', error);
    return NextResponse.json(
      { error: `Audit failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}