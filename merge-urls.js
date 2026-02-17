const fs = require('fs');
const path = require('path');

// Read the new URL list - this is the ONLY source of truth
const newUrlsRaw = fs.readFileSync('C:\\Users\\saignaneswagorle\\Desktop\\new list.txt', 'utf-8');
const newUrls = newUrlsRaw.split('\n').map(u => u.trim()).filter(u => u.length > 0);
const newUrlSet = new Set(newUrls);

// Read existing sites-data1.json to preserve structure for matching URLs
const sitesDataPath = path.join(__dirname, 'public', 'sites-data1.json');
const sitesData = JSON.parse(fs.readFileSync(sitesDataPath, 'utf-8'));

// Build a map of existing page data (url -> page object) so we preserve titles etc.
const existingPageMap = new Map();
for (const site of sitesData.subsites) {
  for (const page of site.pages) {
    existingPageMap.set(page.url, page);
  }
}

const oldTotal = existingPageMap.size;
console.log(`Old sites-data1.json had: ${oldTotal} URLs`);
console.log(`New list has: ${newUrls.length} URLs`);

// Figure out which subsite key each URL belongs to
function getSubsiteKey(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return '';
    return parts[0];
  } catch {
    return '';
  }
}

function generateTitle(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return 'Home';
    const last = parts[parts.length - 1];
    return last
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/%[0-9a-f]{2}/gi, ' ');
  } catch {
    return 'Page';
  }
}

function getPathRelativeToSubsite(url, baseUrl) {
  try {
    const u = new URL(url);
    const base = new URL(baseUrl);
    let relativePath = u.pathname.replace(base.pathname.replace(/\/$/, ''), '');
    if (!relativePath || relativePath === '') relativePath = '/';
    if (u.search) relativePath += u.search;
    return relativePath;
  } catch {
    return '/';
  }
}

// Group ALL new URLs by subsite key
const urlsBySubsite = new Map();
for (const url of newUrls) {
  const key = getSubsiteKey(url);
  if (!urlsBySubsite.has(key)) {
    urlsBySubsite.set(key, []);
  }
  urlsBySubsite.get(key).push(url);
}

// Build existing subsite metadata map (for preserving titles, ids, etc.)
const existingSiteMap = new Map();
for (const site of sitesData.subsites) {
  const key = getSubsiteKey(site.baseUrl);
  existingSiteMap.set(key, site);
}

// Build new subsites array from ONLY the new URL list
const newSubsites = [];

for (const [key, urls] of urlsBySubsite) {
  let site;
  if (existingSiteMap.has(key)) {
    // Reuse existing subsite metadata (id, title, baseUrl)
    const old = existingSiteMap.get(key);
    site = {
      id: old.id,
      baseUrl: old.baseUrl,
      title: old.title,
      isLive: old.isLive,
      pages: []
    };
  } else {
    // Create new subsite
    const baseUrl = key ? `https://education.ufl.edu/${key}/` : 'https://education.ufl.edu/';
    site = {
      id: key ? `education-ufl-edu-${key}` : 'education-ufl-edu',
      baseUrl: baseUrl,
      title: `${(key || 'HOME').toUpperCase().replace(/-/g, ' ')} - UF College of Education`,
      isLive: true,
      pages: []
    };
  }

  // Add pages - reuse existing page data if available, otherwise create new
  for (const url of urls) {
    if (existingPageMap.has(url)) {
      // Preserve existing page entry exactly
      site.pages.push(existingPageMap.get(url));
    } else {
      // New page
      site.pages.push({
        path: getPathRelativeToSubsite(url, site.baseUrl),
        title: generateTitle(url),
        url: url
      });
    }
  }

  newSubsites.push(site);
}

// Sort subsites by id for consistency
newSubsites.sort((a, b) => a.id.localeCompare(b.id));

// Count what changed
const kept = newUrls.filter(u => existingPageMap.has(u)).length;
const added = newUrls.filter(u => !existingPageMap.has(u)).length;
const removed = [...existingPageMap.keys()].filter(u => !newUrlSet.has(u)).length;

// Build final data
const finalData = {
  description: sitesData.description,
  lastUpdated: new Date().toISOString().split('T')[0],
  subsites: newSubsites
};

// Write
fs.writeFileSync(sitesDataPath, JSON.stringify(finalData, null, 2), 'utf-8');

let totalPages = 0;
for (const s of newSubsites) totalPages += s.pages.length;

console.log(`\nResult:`);
console.log(`  Kept (existed in both):  ${kept}`);
console.log(`  Added (new):             ${added}`);
console.log(`  Removed (old, not in new list): ${removed}`);
console.log(`  Total subsites: ${newSubsites.length}`);
console.log(`  Total pages:    ${totalPages}`);
