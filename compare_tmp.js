const fs=require('fs');
const d1=JSON.parse(fs.readFileSync('public/sites-data1.json','utf8'));
const d2=JSON.parse(fs.readFileSync('public/sites-data.json','utf8'));
const dashUrls = new Set();
(d1.subsites||[]).forEach(function(s){ (s.pages||[]).forEach(function(p){ dashUrls.add(p.url); }); });
if (Array.isArray(d2)) {
  d2.forEach(function(s){ (s.pages||[]).forEach(function(p){ dashUrls.add(p.url); }); });
} else if (d2.subsites) {
  d2.subsites.forEach(function(s){ (s.pages||[]).forEach(function(p){ dashUrls.add(p.url); }); });
}

const sheet=JSON.parse(fs.readFileSync('sheet_data_tmp.json','utf8'));
const sheetUrls = new Set();
const sheetByUrl = {};
(sheet.pages||[]).forEach(function(p){ sheetUrls.add(p.url); sheetByUrl[p.url]=p; });

const inDashNotSheet = [...dashUrls].filter(u => !sheetUrls.has(u));
const inSheetNotDash = [...sheetUrls].filter(u => !dashUrls.has(u));

let savedCount = 0;
inSheetNotDash.forEach(u => {
  const p = sheetByUrl[u];
  if (p && (p.status !== 'Not Started' || p.assignedTo)) savedCount++;
});

console.log('=== COMPARISON ===');
console.log('Dashboard URLs:', dashUrls.size);
console.log('Google Sheet URLs:', sheetUrls.size);
console.log('');
console.log('URLs in DASHBOARD but NOT in Sheet:', inDashNotSheet.length);
console.log('  -> These pages CANNOT save (no row in sheet)');
console.log('URLs in SHEET but NOT in Dashboard:', inSheetNotDash.length);
console.log('  -> Of these,', savedCount, 'have saved progress');

if (inDashNotSheet.length > 0) {
  console.log('');
  console.log('Sample dashboard URLs MISSING from sheet (first 15):');
  inDashNotSheet.sort().slice(0,15).forEach(u => console.log('  ' + u));
}
