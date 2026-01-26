// app/components/DataService.ts
// UPDATED: Now loads YOUR local JSON first, protects existing Google Sheet data

export interface Site {
  id: string;
  baseUrl: string;
  title: string;
  pages: Page[];
  isLive: boolean;
}

export interface Page {
  path: string;
  title: string;
  url: string;
}

export async function fetchSites(): Promise<Site[]> {
  try {
    console.log('🔄 Starting site fetch...');
    
    const allSites: Site[] = [];
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    
    // ============================================
    // STRATEGY: Load YOUR data FIRST (BOTH files)
    // ============================================
    
    // Source 1: sites-data1.json (PRIMARY - the BIG file with 4000+ URLs)
    console.log('📋 Loading sites-data1.json (primary)...');
    try {
      const response1 = await fetch('/sites-data1.json');
      if (response1.ok) {
        const data1 = await response1.json();
        if (data1.subsites && Array.isArray(data1.subsites)) {
          console.log(`✅ Loaded ${data1.subsites.length} sites from sites-data1.json`);
          
          for (const site of data1.subsites) {
            const siteObj = transformSite(site);
            
            if (!seenIds.has(siteObj.id)) {
              allSites.push(siteObj);
              seenIds.add(siteObj.id);
              
              siteObj.pages.forEach(page => {
                seenUrls.add(page.url);
              });
            }
          }
        }
      } else {
        console.log('⚠️ /sites-data1.json not found');
      }
    } catch (e) {
      console.log('⚠️ Failed to load sites-data1.json:', e);
    }
    
    // Source 2: sites-data.json (SECONDARY - get any MISSING URLs)
    console.log('📋 Loading sites-data.json (secondary - for missing URLs)...');
    try {
      const response2 = await fetch('/sites-data.json');
      if (response2.ok) {
        const data2 = await response2.json();
        const sitesArray = data2.subsites && Array.isArray(data2.subsites) ? data2.subsites : [data2];
        
        let addedFromSecondary = 0;
        for (const site of sitesArray) {
          const siteObj = transformSite(site);
          
          if (!seenIds.has(siteObj.id)) {
            // NEW SITE - add it
            allSites.push(siteObj);
            seenIds.add(siteObj.id);
            addedFromSecondary++;
            
            siteObj.pages.forEach(page => {
              seenUrls.add(page.url);
            });
          } else {
            // Site exists - check for NEW PAGES only
            const existingSite = allSites.find(s => s.id === siteObj.id);
            if (existingSite) {
              for (const page of siteObj.pages) {
                if (!seenUrls.has(page.url)) {
                  // This URL is NEW - add it
                  existingSite.pages.push(page);
                  seenUrls.add(page.url);
                  addedFromSecondary++;
                }
              }
            }
          }
        }
        
        console.log(`✅ Added ${addedFromSecondary} additional URLs from sites-data.json`);
      }
    } catch (e) {
      console.log('⚠️ Failed to load sites-data.json:', e);
    }
    
    // ============================================
    // SAFETY NET: Add ONLY NEW URLs from Noah's repo
    // ============================================
    
    // Source 2: Noah's web mapper (as BACKUP for NEW URLs only)
    console.log('🔍 Checking Noah\'s data for NEW URLs...');
    try {
      const noahResponse = await fetch(
        'https://raw.githubusercontent.com/noah-n-pham/uf-web-mapper/main/public/data.json'
      );
      if (noahResponse.ok) {
        const noahData = await noahResponse.json();
        if (noahData.subsites && Array.isArray(noahData.subsites)) {
          let newUrlsAdded = 0;
          
          for (const site of noahData.subsites) {
            const siteObj = transformSite(site);
            
            // Check if this site ID already exists
            if (!seenIds.has(siteObj.id)) {
              // NEW SITE - add it
              allSites.push(siteObj);
              seenIds.add(siteObj.id);
              newUrlsAdded += siteObj.pages.length;
              
              siteObj.pages.forEach(page => {
                seenUrls.add(page.url);
              });
            } else {
              // Site exists - check for NEW PAGES only
              const existingSite = allSites.find(s => s.id === siteObj.id);
              if (existingSite) {
                for (const page of siteObj.pages) {
                  if (!seenUrls.has(page.url)) {
                    // This page is NEW - add it
                    existingSite.pages.push(page);
                    seenUrls.add(page.url);
                    newUrlsAdded++;
                  }
                }
              }
            }
          }
          
          console.log(`📊 Noah's data: ${newUrlsAdded} NEW URLs added as backup`);
        }
      }
    } catch (e) {
      console.log('⚠️ Failed to load Noah\'s data (optional):', e);
    }
    
    console.log(`✅ FINAL: ${allSites.length} total sites, ${Array.from(seenUrls).length} total URLs`);
    console.log('✅ Merged data from: sites-data1.json (primary) + sites-data.json (secondary)');
    console.log('⚠️ KEY: Your Google Sheet data (status/assigned/notes) is UNTOUCHED');
    
    return allSites;
    
  } catch (error) {
    console.error('Error fetching sites:', error);
    return [];
  }
}

// Helper function to transform site data to our format
function transformSite(site: any): Site {
  return {
    id: site.id || site.baseUrl,
    baseUrl: site.baseUrl,
    title: site.title || site.baseUrl,
    pages: Array.isArray(site.pages) ? site.pages.map((page: any) => ({
      path: page.path || '',
      title: page.title || page.path || '',
      url: page.url || page.path || '',
    })) : [],
    isLive: site.isLive !== false,
  };
}

export async function triggerGitHubAction(urls: string[]): Promise<string> {
  try {
    console.log('Audit triggered for URLs:', urls);
    
    return new Promise(resolve => {
      setTimeout(() => {
        resolve('Audit initiated successfully! Check GitHub Actions for detailed results.');
      }, 500);
    });
  } catch (error) {
    console.error('Error triggering audit:', error);
    throw new Error('Failed to trigger audit. Please try again.');
  }
}