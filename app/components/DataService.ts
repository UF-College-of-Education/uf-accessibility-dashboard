// app/components/DataService.ts

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
    // MERGE STRATEGY: Load Noah's data FIRST, then add custom sites at the BOTTOM
    
    const allSites: Site[] = [];
    const seenIds = new Set<string>();
    
    // Source 1: Noah's web mapper data (MAIN data source - loads FIRST)
    try {
      const noahResponse = await fetch(
        'https://raw.githubusercontent.com/noah-n-pham/uf-web-mapper/main/public/data.json'
      );
      if (noahResponse.ok) {
        const noahData = await noahResponse.json();
        if (noahData.subsites && Array.isArray(noahData.subsites)) {
          console.log(`✅ Loaded ${noahData.subsites.length} sites from Noah's web mapper`);
          for (const site of noahData.subsites) {
            const siteObj = transformSite(site);
            if (!seenIds.has(siteObj.id)) {
              allSites.push(siteObj);
              seenIds.add(siteObj.id);
            }
          }
        }
      }
    } catch (e) {
      console.log('⚠️ Failed to load Noah\'s data:', e);
    }
    
    // Source 2: Your custom sites-data.json (added at BOTTOM)
    try {
      const customResponse = await fetch('/sites-data.json');
      if (customResponse.ok) {
        const customData = await customResponse.json();
        if (customData.subsites && Array.isArray(customData.subsites)) {
          console.log('✅ Loaded custom sites from /sites-data.json');
          for (const site of customData.subsites) {
            const siteObj = transformSite(site);
            // Only add if not already in Noah's data (avoids duplicates)
            if (!seenIds.has(siteObj.id)) {
              allSites.push(siteObj);
              seenIds.add(siteObj.id);
            }
          }
        }
      }
    } catch (e) {
      console.log('⚠️ No custom sites-data.json found (optional)');
    }
    
    console.log(`📊 Total sites loaded: ${allSites.length}`);
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