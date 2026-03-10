// app/api/sheets/route.ts
// Server-side proxy for ALL Google Sheets requests (both GET and POST).
// This eliminates CORS/redirect issues and removes the need for
// NEXT_PUBLIC_GOOGLE_SCRIPT_URL on the client side.

import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || '';

export async function GET(request: NextRequest) {
  if (!GOOGLE_SCRIPT_URL) {
    return NextResponse.json({ success: false, error: 'Google Script URL not configured' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'getAllData';

    const url = `${GOOGLE_SCRIPT_URL}?action=${action}&t=${Date.now()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Google Script returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Sheets proxy GET error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

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
    console.error('Sheets proxy POST error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
