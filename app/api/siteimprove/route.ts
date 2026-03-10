import { NextRequest, NextResponse } from 'next/server';

const SITEIMPROVE_EMAIL = process.env.SITEIMPROVE_EMAIL || '';
const SITEIMPROVE_API_KEY = process.env.SITEIMPROVE_API_KEY || '';
const BASE_URL = 'https://api.eu.siteimprove.com/v2';

function getAuthHeader(): string {
  return 'Basic ' + Buffer.from(`${SITEIMPROVE_EMAIL}:${SITEIMPROVE_API_KEY}`).toString('base64');
}

async function siteimproveGet(path: string): Promise<any> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Siteimprove API ${response.status}: ${text.substring(0, 200)}`);
  }

  return response.json();
}

/**
 * Fetch all pages for a given conformance level (a, aa, or aria)
 * Paginates through all results
 */
async function fetchAllPagesForConformance(siteId: string, conformance: string): Promise<any[]> {
  const allPages: any[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 50) {
    const data = await siteimproveGet(
      `/sites/${siteId}/a11y/issue_kinds/confirmed/pages?conformance=${conformance}&page_size=100&page=${page}`
    );

    if (data.items) {
      allPages.push(...data.items.map((p: any) => ({ ...p, _conformance: conformance })));
    }
    totalPages = data.total_pages || 1;
    page++;

    // Rate limit: ~5 req/sec
    if (page <= totalPages) {
      await new Promise(r => setTimeout(r, 220));
    }
  }

  return allPages;
}

// GET: List sites or fetch site summary
export async function GET(request: NextRequest) {
  if (!SITEIMPROVE_EMAIL || !SITEIMPROVE_API_KEY) {
    return NextResponse.json({ error: 'Siteimprove not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    if (action === 'sites') {
      const data = await siteimproveGet('/sites?page_size=100');
      const sites = (data.items || []).map((s: any) => ({
        id: s.id,
        name: s.site_name,
        url: s.url,
        pages: s.pages,
      }));
      return NextResponse.json({ success: true, sites });
    }

    if (action === 'summary') {
      const siteId = searchParams.get('siteId');
      if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

      const data = await siteimproveGet(`/sites/${siteId}/a11y/overview/summary`);
      return NextResponse.json({ success: true, summary: data });
    }

    return NextResponse.json({ error: 'Unknown action. Use ?action=sites or ?action=summary&siteId=...' }, { status: 400 });
  } catch (error) {
    console.error('Siteimprove GET error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST: Fetch accessibility issues for pages
export async function POST(request: NextRequest) {
  if (!SITEIMPROVE_EMAIL || !SITEIMPROVE_API_KEY) {
    return NextResponse.json({ error: 'Siteimprove not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action, siteId } = body;

    if (action === 'fetchPages') {
      // Fetch pages separately for each conformance level (multi-filter causes API 500)
      const [aPages, aaPages, ariaPages] = await Promise.all([
        fetchAllPagesForConformance(siteId, 'a'),
        fetchAllPagesForConformance(siteId, 'aa'),
        fetchAllPagesForConformance(siteId, 'aria'),
      ]);

      // Merge by page URL — combine issue counts from each conformance level
      const pageMap = new Map<string, {
        pageId: number;
        url: string;
        title: string;
        issues: number;
        occurrences: number;
        aIssues: number;
        aaIssues: number;
        ariaIssues: number;
        aOccurrences: number;
        aaOccurrences: number;
        ariaOccurrences: number;
      }>();

      for (const p of aPages) {
        const url = p.url || '';
        const existing = pageMap.get(url);
        if (existing) {
          existing.aIssues = p.issues || 0;
          existing.aOccurrences = p.occurrences || 0;
          existing.issues += p.issues || 0;
          existing.occurrences += p.occurrences || 0;
        } else {
          pageMap.set(url, {
            pageId: p.id, url, title: p.title || '',
            issues: p.issues || 0, occurrences: p.occurrences || 0,
            aIssues: p.issues || 0, aaIssues: 0, ariaIssues: 0,
            aOccurrences: p.occurrences || 0, aaOccurrences: 0, ariaOccurrences: 0,
          });
        }
      }

      for (const p of aaPages) {
        const url = p.url || '';
        const existing = pageMap.get(url);
        if (existing) {
          existing.aaIssues = p.issues || 0;
          existing.aaOccurrences = p.occurrences || 0;
          existing.issues += p.issues || 0;
          existing.occurrences += p.occurrences || 0;
        } else {
          pageMap.set(url, {
            pageId: p.id, url, title: p.title || '',
            issues: p.issues || 0, occurrences: p.occurrences || 0,
            aIssues: 0, aaIssues: p.issues || 0, ariaIssues: 0,
            aOccurrences: 0, aaOccurrences: p.occurrences || 0, ariaOccurrences: 0,
          });
        }
      }

      for (const p of ariaPages) {
        const url = p.url || '';
        const existing = pageMap.get(url);
        if (existing) {
          existing.ariaIssues = p.issues || 0;
          existing.ariaOccurrences = p.occurrences || 0;
          existing.issues += p.issues || 0;
          existing.occurrences += p.occurrences || 0;
        } else {
          pageMap.set(url, {
            pageId: p.id, url, title: p.title || '',
            issues: p.issues || 0, occurrences: p.occurrences || 0,
            aIssues: 0, aaIssues: 0, ariaIssues: p.issues || 0,
            aOccurrences: 0, aaOccurrences: 0, ariaOccurrences: p.occurrences || 0,
          });
        }
      }

      const pages = Array.from(pageMap.values());

      return NextResponse.json({ success: true, pages, total: pages.length });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Siteimprove POST error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
