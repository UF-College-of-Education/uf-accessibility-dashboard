// app/api/lighthouse/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface LighthouseResult {
  url: string;
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  performanceIssues: Array<{
    title: string;
    description: string;
    score: number;
    displayValue?: string;
    recommendation: string;
  }>;
  accessibilityIssues: Array<{
    title: string;
    description: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    nodes: Array<{
      html: string;
      target: string;
    }>;
    recommendation: string;
  }>;
  bestPracticesIssues: Array<{
    title: string;
    description: string;
    recommendation: string;
  }>;
  seoIssues: Array<{
    title: string;
    description: string;
    recommendation: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log(`Starting PageSpeed Insights audit for: ${url}`);

    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO&strategy=mobile`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`PageSpeed API failed: ${response.statusText}`);
    }

    const data = await response.json();
    const lhr = data.lighthouseResult;

    if (!lhr) {
      throw new Error('No Lighthouse result in PageSpeed response');
    }

    const scores = {
      performance: Math.round((lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((lhr.categories.seo?.score || 0) * 100),
    };

    const performanceIssues = [];
    const perfAudits = ['first-contentful-paint', 'largest-contentful-paint', 'speed-index', 'total-blocking-time', 'cumulative-layout-shift', 'render-blocking-resources', 'uses-optimized-images', 'uses-text-compression', 'unused-css-rules', 'unused-javascript', 'modern-image-formats', 'uses-responsive-images', 'efficient-animated-content', 'server-response-time'];

    for (const auditId of perfAudits) {
      const audit = lhr.audits[auditId];
      if (audit && (audit.score === null || audit.score < 0.9)) {
        performanceIssues.push({
          title: audit.title,
          description: audit.description,
          score: audit.score ? Math.round(audit.score * 100) : 0,
          displayValue: audit.displayValue || '',
          recommendation: audit.description,
        });
      }
    }

    const accessibilityIssues = [];
    const a11yAudits = ['color-contrast', 'image-alt', 'button-name', 'link-name', 'label', 'aria-required-attr', 'aria-valid-attr', 'aria-valid-attr-value', 'document-title', 'html-has-lang', 'meta-viewport', 'duplicate-id-active', 'duplicate-id-aria', 'heading-order', 'list', 'listitem', 'tabindex', 'td-headers-attr', 'th-has-data-cells', 'valid-lang', 'video-caption', 'form-field-multiple-labels'];

    for (const auditId of a11yAudits) {
      const audit = lhr.audits[auditId];
      if (audit && audit.score !== null && audit.score < 1) {
        const nodes = audit.details?.items?.slice(0, 3).map((item: any) => ({
          html: item.node?.snippet || item.snippet || '',
          target: item.node?.selector || item.selector || '',
        })) || [];

        accessibilityIssues.push({
          title: audit.title,
          description: audit.description,
          impact: audit.score === 0 ? 'critical' : audit.score < 0.5 ? 'serious' : 'moderate',
          nodes,
          recommendation: audit.description,
        });
      }
    }

    const bestPracticesIssues = [];
    const bpAudits = ['errors-in-console', 'is-on-https', 'uses-http2', 'uses-passive-event-listeners', 'no-document-write', 'geolocation-on-start', 'notification-on-start', 'deprecations', 'doctype', 'charset', 'no-vulnerable-libraries', 'js-libraries', 'inspector-issues'];

    for (const auditId of bpAudits) {
      const audit = lhr.audits[auditId];
      if (audit && (audit.score === null || audit.score < 1)) {
        bestPracticesIssues.push({
          title: audit.title,
          description: audit.description,
          recommendation: audit.description,
        });
      }
    }

    const seoIssues = [];
    const seoAudits = ['meta-description', 'document-title', 'link-text', 'is-crawlable', 'robots-txt', 'hreflang', 'canonical', 'font-size', 'tap-targets', 'structured-data', 'image-alt'];

    for (const auditId of seoAudits) {
      const audit = lhr.audits[auditId];
      if (audit && (audit.score === null || audit.score < 1)) {
        seoIssues.push({
          title: audit.title,
          description: audit.description,
          recommendation: audit.description,
        });
      }
    }

    const result: LighthouseResult = {
      url,
      scores,
      performanceIssues,
      accessibilityIssues,
      bestPracticesIssues,
      seoIssues,
    };

    console.log(`PageSpeed audit completed for: ${url}`);
    return NextResponse.json(result);
  } catch (error) {
    console.error('PageSpeed Insights error:', error);
    return NextResponse.json(
      { error: `Audit failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
