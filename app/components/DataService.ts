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
    // Fetch from Noah's real data
    const response = await fetch(
      'https://raw.githubusercontent.com/noah-n-pham/uf-web-mapper/main/public/data.json'
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }
    
    const data = await response.json();
    
    // Transform Noah's data format to our format
    if (data.subsites && Array.isArray(data.subsites)) {
      return data.subsites.map((site: any) => ({
        id: site.id || site.baseUrl,
        baseUrl: site.baseUrl,
        title: site.title || site.baseUrl,
        pages: Array.isArray(site.pages) ? site.pages.map((page: any) => ({
          path: page.path || '',
          title: page.title || page.path || '',
          url: page.url || page.path || '',
        })) : [],
        isLive: site.isLive !== false,
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching sites:', error);
    return [];
  }
}

export async function triggerGitHubAction(urls: string[]): Promise<string> {
  try {
    // Simulate audit trigger for now
    // In production, connect to backend API with proper GitHub authentication
    console.log('Audit triggered for URLs:', urls);
    
    // Simulate successful response
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