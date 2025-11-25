// app/components/N8nTriggerService.ts
// Service to trigger n8n accessibility scans from the dashboard

export interface N8nScanResponse {
  success: boolean;
  totalScanned: number;
  totalIssues: number;
  criticalCount: number;
  seriousCount?: number;
  message: string;
  files: string[];
}

/**
 * Trigger n8n accessibility scan via webhook
 */
export async function triggerN8nScan(
  pages: Array<{ url: string; title: string }>
): Promise<N8nScanResponse> {
  
  // Get webhook URL from environment
  const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
  
  if (!webhookUrl) {
    throw new Error('n8n webhook URL not configured. Please set NEXT_PUBLIC_N8N_WEBHOOK_URL in environment variables.');
  }
  
  console.log(`🚀 Triggering n8n scan for ${pages.length} pages...`);
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: pages.map(page => ({
          url: page.url,
          title: page.title,
          site: 'UF College of Education'
        })),
        timestamp: new Date().toISOString(),
        source: 'uf-accessibility-dashboard'
      })
    });
    
    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.status} ${response.statusText}`);
    }
    
    const result: N8nScanResponse = await response.json();
    
    console.log(`✅ n8n scan completed:`, result);
    
    return result;
    
  } catch (error) {
    console.error('❌ Failed to trigger n8n scan:', error);
    
    if (error instanceof Error) {
      throw new Error(`Failed to trigger n8n scan: ${error.message}`);
    }
    
    throw new Error('Failed to trigger n8n scan: Unknown error');
  }
}

/**
 * Estimate scan time based on number of pages
 */
export function estimateScanTime(pageCount: number): string {
  if (pageCount <= 1) return '30 seconds';
  if (pageCount <= 5) return '2-3 minutes';
  if (pageCount <= 10) return '5 minutes';
  if (pageCount <= 20) return '10 minutes';
  if (pageCount <= 50) return '25 minutes';
  return '1-2 hours';
}