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
  console.log(`🔗 Webhook URL: ${webhookUrl}`);
  
  try {
    const requestBody = {
      urls: pages.map(page => ({
        url: page.url,
        title: page.title,
        site: 'UF College of Education'
      })),
      timestamp: new Date().toISOString(),
      source: 'uf-accessibility-dashboard'
    };
    
    console.log(`📤 Sending request:`, requestBody);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    console.log(`📡 Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ n8n error response:', errorText);
      throw new Error(`n8n webhook returned ${response.status}: ${errorText.substring(0, 200)}`);
    }
    
    // Get response as text first to see what we're dealing with
    const responseText = await response.text();
    console.log(`📄 Response body (${responseText.length} chars):`, responseText.substring(0, 500));
    
    // Check if response is empty
    if (!responseText || responseText.trim() === '') {
      console.error('❌ Empty response from n8n');
      throw new Error('n8n returned empty response. Workflow may not have "Respond to Webhook" node configured correctly.');
    }
    
    // Try to parse as JSON
    let result: N8nScanResponse;
    try {
      result = JSON.parse(responseText);
      console.log(`✅ Parsed JSON successfully:`, result);
    } catch (parseError) {
      console.error('❌ Failed to parse JSON response');
      console.error('Response was:', responseText);
      throw new Error(`n8n returned invalid JSON. Response: ${responseText.substring(0, 100)}...`);
    }
    
    // Validate response structure
    if (!result.success) {
      throw new Error(`n8n scan failed: ${result.message || 'Unknown error'}`);
    }
    
    console.log(`✅ n8n scan completed successfully!`);
    console.log(`   - Scanned: ${result.totalScanned} pages`);
    console.log(`   - Found: ${result.totalIssues} issues`);
    console.log(`   - Critical: ${result.criticalCount}`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Failed to trigger n8n scan:', error);
    
    if (error instanceof Error) {
      // Re-throw with more context
      throw new Error(`n8n scan failed: ${error.message}`);
    }
    
    throw new Error('n8n scan failed: Unknown error');
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