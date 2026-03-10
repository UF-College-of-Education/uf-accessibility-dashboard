// app/api/sheets/route.ts
// Server-side proxy for Google Sheets POST requests.
// Avoids CORS/redirect issues that break browser-side POST to Google Apps Script.

import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || '';

export async function POST(request: NextRequest) {
  if (!GOOGLE_SCRIPT_URL) {
    return NextResponse.json({ success: false, error: 'Google Script URL not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();

    // POST to Google Apps Script from server side (no CORS, follows redirects properly)
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });

    // Try to parse the response
    let data;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawResponse: text };
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Sheets proxy error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
