# UF Accessibility Audit Dashboard

Automated accessibility compliance checks for WCAG 2.1 Level AA standards across all UF College of Education websites.

## 🌐 Live Dashboard

**Production URL:** https://uf-accessibility-dashboard.vercel.app

---

## 📋 Features

| Feature | Description | Works Online | Works Locally |
|---------|-------------|--------------|---------------|
| **Lighthouse Score** | Performance, accessibility, SEO metrics | ✅ Yes | ✅ Yes |
| **Real Scan** | Full accessibility scan with axe-core | ❌ No | ✅ Yes (needs n8n) |
| **View Latest Data** | Pre-scanned accessibility results | ✅ Yes | ✅ Yes |
| **Status Check** | Track completion status for all pages | ✅ Yes | ✅ Yes |
| **Google Sheets Sync** | Two-way sync with Google Sheets | ✅ Yes | ✅ Yes |
| **Export to Sheet** | Export all pages to Google Sheets | ✅ Yes | ✅ Yes |

---

## 🚀 Quick Start (View Only)

Just visit: https://uf-accessibility-dashboard.vercel.app

No installation needed for:
- Viewing Lighthouse scores
- Checking page status
- Viewing pre-scanned data
- Syncing with Google Sheets

---

## 💻 Local Development Setup

### Prerequisites

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)
- **VS Code** (recommended) - [Download](https://code.visualstudio.com/)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/UF-College-of-Education/uf-accessibility-dashboard.git

# 2. Navigate to project folder
cd uf-accessibility-dashboard

# 3. Install dependencies
npm install

# 4. Create environment file
copy .env.example .env.local
# Or on Mac/Linux: cp .env.example .env.local

# 5. Start development server
npm run dev
```

Open http://localhost:3000 in your browser.

### Environment Variables

Create `.env.local` file in the project root:

```env
# For Real Scan feature (local only)
NEXT_PUBLIC_N8N_WEBHOOK_URL=http://localhost:5678/webhook/uf-accessibility-scan

# For Google Sheets sync
NEXT_PUBLIC_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

---

## 🔍 Real Scan Setup (Local Only)

Real Scan uses **n8n** (workflow automation) + **Playwright** (browser automation) + **axe-core** (accessibility testing) to perform actual accessibility scans.

### Why Local Only?

Real Scan requires:
- A running n8n server
- Playwright browser automation
- These cannot run on Vercel's serverless environment

### Step 1: Install n8n

```bash
# Create a folder for n8n
mkdir C:\n8n-custom
cd C:\n8n-custom

# Initialize npm
npm init -y

# Install n8n and playwright
npm install n8n playwright
```

### Step 2: Install Playwright Browsers

```bash
npx playwright install chromium
```

### Step 3: Create n8n Startup Script

Create `START-N8N.ps1` in `C:\n8n-custom\`:

```powershell
# START-N8N.ps1 - Start n8n with Playwright support

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Starting n8n with Playwright Support" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Set environment variables
$env:NODE_FUNCTION_ALLOW_EXTERNAL = "playwright"
$env:NODE_PATH = "C:\n8n-custom\node_modules"

Write-Host "[OK] Environment variables set" -ForegroundColor Green
Write-Host "     NODE_FUNCTION_ALLOW_EXTERNAL = playwright" -ForegroundColor Gray

# Check if port 5678 is in use
$portInUse = Get-NetTCPConnection -LocalPort 5678 -ErrorAction SilentlyContinue

if ($portInUse) {
    Write-Host "[!] Port 5678 is already in use" -ForegroundColor Yellow
    Write-Host "    n8n might already be running" -ForegroundColor Yellow
    
    $response = Read-Host "Kill existing process and restart? (y/n)"
    if ($response -eq 'y') {
        $processId = $portInUse.OwningProcess | Select-Object -First 1
        Stop-Process -Id $processId -Force
        Write-Host "[OK] Process killed" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } else {
        Write-Host "Opening n8n in browser..." -ForegroundColor Cyan
        Start-Process "http://localhost:5678"
        exit
    }
}

# Start n8n
Write-Host ""
Write-Host "Starting n8n..." -ForegroundColor Cyan
Write-Host "Access n8n at: http://localhost:5678" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop n8n" -ForegroundColor Yellow
Write-Host ""

npx n8n
```

### Step 4: Run n8n

```powershell
# Option 1: Double-click START-N8N.ps1

# Option 2: Run from PowerShell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
C:\n8n-custom\START-N8N.ps1
```

### Step 5: Import n8n Workflow

1. Open http://localhost:5678
2. Create account (first time only)
3. Go to **Workflows** → **Import from File**
4. Import the workflow JSON (see below)
5. **Activate** the workflow

### Step 6: Test Real Scan

1. Start n8n (`START-N8N.ps1`)
2. Start dashboard (`npm run dev`)
3. Open http://localhost:3000
4. Select a page → Click **"Real Scan"**
5. Wait for results (~30 seconds per page)

---

## 📊 n8n Workflow

The n8n workflow does:
1. Receives page URL from dashboard
2. Launches Chromium browser with Playwright
3. Navigates to the page
4. Injects axe-core accessibility testing library
5. Runs accessibility audit
6. Returns issues with severity (critical, serious, moderate, minor)

### Workflow JSON

Create a new workflow in n8n and use this configuration:

**Webhook Node:**
- HTTP Method: POST
- Path: `uf-accessibility-scan`

**Code Node (Playwright + axe-core):**
```javascript
const playwright = require('playwright');

const results = [];

for (const item of $input.all()) {
  const url = item.json.url;
  
  const browser = await playwright.chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Inject axe-core
    await page.addScriptTag({ 
      url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js' 
    });
    
    // Run accessibility audit
    const axeResults = await page.evaluate(async () => {
      return await axe.run();
    });
    
    // Process violations
    const issues = axeResults.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map(n => ({
        html: n.html,
        target: n.target.join(', '),
        failureSummary: n.failureSummary
      }))
    }));
    
    results.push({
      json: {
        url: url,
        title: await page.title(),
        issues: issues,
        totalIssues: issues.length,
        criticalCount: issues.filter(i => i.impact === 'critical').length,
        seriousCount: issues.filter(i => i.impact === 'serious').length,
        moderateCount: issues.filter(i => i.impact === 'moderate').length,
        minorCount: issues.filter(i => i.impact === 'minor').length,
        scannedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    results.push({
      json: {
        url: url,
        error: error.message,
        issues: [],
        totalIssues: 0
      }
    });
  } finally {
    await browser.close();
  }
}

return results;
```

**Respond to Webhook Node:**
- Respond with: All incoming items

---

## 📱 Google Sheets Integration

### Features
- **Two-way sync**: Changes on website ↔ Changes on sheet
- **Auto-load**: Data loads from Google Sheets when page opens
- **Real-time updates**: Status changes sync immediately
- **Team collaboration**: Everyone sees the same data

### Setup Google Sheets

1. **Create Google Sheet** or use existing one

2. **Create Apps Script**:
   - Open Google Sheet
   - Go to **Extensions → Apps Script**
   - Paste the Google Apps Script code (see `GoogleAppsScript.js`)
   - Save and Deploy as Web App
   - Set "Execute as: Me" and "Who has access: Anyone"
   - Copy the Web App URL

3. **Add to Environment**:
   ```env
   NEXT_PUBLIC_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```

4. **For Vercel**: Add the same variable in Vercel Dashboard → Settings → Environment Variables

### Sheet Structure

| Column A | Column B | Column C | Column D | Column E |
|----------|----------|----------|----------|----------|
| Site Name | Page (hyperlink) | Assigned To | Status | Notes |

---

## 🏗️ Project Structure

```
uf-accessibility-dashboard/
├── app/
│   ├── components/
│   │   ├── DataService.ts          # Fetch sites data
│   │   ├── GoogleSheetsService.ts  # Google Sheets sync
│   │   ├── StatusCheckPage.tsx     # Status tracking UI
│   │   ├── SiteSelector.tsx        # Site/page selection
│   │   ├── ResultsModal.tsx        # Scan results display
│   │   ├── LatestDataModal.tsx     # View pre-scanned data
│   │   └── LatestDataService.ts    # Fetch pre-scanned data
│   ├── api/
│   │   └── lighthouse/
│   │       └── route.ts            # Lighthouse API endpoint
│   ├── page.tsx                    # Main page
│   ├── layout.tsx                  # App layout
│   └── globals.css                 # Global styles
├── public/
│   └── scan-data/                  # Pre-scanned JSON data
│       ├── index.json
│       └── [site-folder]/
│           └── index.json
├── scripts/                        # PowerShell scripts (local)
│   ├── START-N8N.ps1
│   ├── AUTO-SCAN.ps1
│   └── SETUP-TASK-SCHEDULER.ps1
├── .env.local                      # Environment variables
├── package.json
└── README.md
```

---

## 🔧 Troubleshooting

### Real Scan Not Working

1. **Is n8n running?**
   ```powershell
   # Check if port 5678 is in use
   netstat -ano | findstr :5678
   ```

2. **Is the workflow activated?**
   - Open http://localhost:5678
   - Check workflow has green "Active" toggle

3. **Check webhook URL in .env.local**
   ```env
   NEXT_PUBLIC_N8N_WEBHOOK_URL=http://localhost:5678/webhook/uf-accessibility-scan
   ```

### Google Sheets Not Syncing

1. **Check environment variable**
   - Local: `.env.local` file
   - Vercel: Settings → Environment Variables

2. **Test the script URL**
   - Open in browser: `YOUR_SCRIPT_URL?action=getAllData`
   - Should return JSON with `"success": true`

3. **Redeploy on Vercel** after changing environment variables

### PowerShell Script Won't Run

```powershell
# Fix execution policy
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

# Or unblock the file
Unblock-File -Path "C:\n8n-custom\START-N8N.ps1"
```

---

## 📦 Tech Stack

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Accessibility Testing**: axe-core, Lighthouse
- **Automation**: n8n, Playwright
- **Database**: Google Sheets (via Apps Script)
- **Hosting**: Vercel

---

## 👥 Team

UF College of Education - Web Accessibility Team

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🆘 Support

For issues or questions:
1. Check [Troubleshooting](#-troubleshooting) section
2. Open an issue on GitHub
3. Contact the web team

---

## 📝 Changelog

### v2.0.0 (November 2025)
- Added Real Scan with n8n + Playwright + axe-core
- Added Google Sheets two-way sync
- Added Status Check page
- Added View Latest Data feature
- Added team member management

### v1.0.0 (Initial Release)
- Lighthouse score auditing
- Site/page selection
- Basic export functionality