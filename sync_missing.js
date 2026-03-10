const fs = require('fs');

// Load sheet data
const sheet = JSON.parse(fs.readFileSync('sheet_data_tmp.json', 'utf8'));
const sheetByUrl = {};
sheet.pages.forEach(p => { sheetByUrl[p.url] = p; });

// Load dashboard data
const d1 = JSON.parse(fs.readFileSync('public/sites-data1.json', 'utf8'));
const d2 = JSON.parse(fs.readFileSync('public/sites-data.json', 'utf8'));
const dashUrls = new Set();
(d1.subsites || []).forEach(s => (s.pages || []).forEach(p => dashUrls.add(p.url)));
if (d2.subsites) {
  d2.subsites.forEach(s => (s.pages || []).forEach(p => dashUrls.add(p.url)));
}

// Find pages in sheet that are completed but we want to check diff
const sheetCompleted = sheet.pages.filter(p => p.status === 'Completed');
console.log('Sheet completed pages:', sheetCompleted.length);
console.log('Sheet total pages:', sheet.pages.length);

// The real issue: find which completed pages in localStorage are NOT completed in sheet
// We need to read localStorage from the browser, but we can check from sheet perspective
const sheetCompletedUrls = new Set(sheetCompleted.map(p => p.url));
console.log('\nCompleted in sheet: ', sheetCompletedUrls.size);

// Check for pages with status changes
const working = sheet.pages.filter(p => p.status === 'Working on it' || p.status === 'Working On');
const issues = sheet.pages.filter(p => p.status === 'Facing Issues');
console.log('Working on it:', working.length);
console.log('Facing Issues:', issues.length);
console.log('Not Started:', sheet.pages.filter(p => p.status === 'Not Started').length);
