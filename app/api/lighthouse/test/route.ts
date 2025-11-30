// app/api/lighthouse/test/route.ts
// TEST FILE - Check if your Google PageSpeed API key is working

import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.PAGESPEED_API_KEY;
  
  // Check 1: Is API key present?
  if (!apiKey) {
    return NextResponse.json({ 
      success: false,
      error: 'NO API KEY FOUND',
      message: 'PAGESPEED_API_KEY is not set in .env.local',
      fix: 'Create .env.local file with: PAGESPEED_API_KEY=your-key-here'
    });
  }
  
  // Check 2: Test the API with a simple URL
  const testUrl = 'https://example.com';
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(testUrl)}&category=ACCESSIBILITY&strategy=desktop&key=${apiKey}`;
  
  try {
    console.log('Testing API with key:', apiKey.substring(0, 10) + '...');
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    // Check 3: Did Google return an error?
    if (data.error) {
      return NextResponse.json({ 
        success: false,
        error: 'GOOGLE API ERROR',
        googleError: data.error,
        keyPreview: apiKey.substring(0, 15) + '...',
        possibleFixes: [
          '1. Check if API key is correct (no extra spaces)',
          '2. Make sure PageSpeed Insights API is enabled in Google Cloud Console',
          '3. Check if API key has restrictions that block it'
        ]
      });
    }
    
    // Check 4: Extract score
    const score = data.lighthouseResult?.categories?.accessibility?.score;
    const audits = data.lighthouseResult?.audits || {};
    const failedAudits = Object.values(audits).filter((a: any) => a.score !== null && a.score < 1);
    
    return NextResponse.json({ 
      success: true,
      message: 'API KEY IS WORKING! ✅',
      testUrl: testUrl,
      accessibilityScore: score ? Math.round(score * 100) : 0,
      totalAudits: Object.keys(audits).length,
      failedAudits: failedAudits.length,
      keyPreview: apiKey.substring(0, 15) + '...',
      sampleAudit: failedAudits[0] ? {
        id: (failedAudits[0] as any).id,
        title: (failedAudits[0] as any).title,
        score: (failedAudits[0] as any).score
      } : null
    });
    
  } catch (err: any) {
    return NextResponse.json({ 
      success: false,
      error: 'FETCH ERROR',
      message: err.message,
      keyPreview: apiKey.substring(0, 15) + '...'
    });
  }
}