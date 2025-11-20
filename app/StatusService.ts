// app/components/StatusService.ts

export interface PageStatus {
  url: string;
  title: string;
  isCompleted: boolean;
  completedBy: string | null;
  status: 'pending' | 'working' | 'completed';
  completedDate: string | null;
}

export interface SiteStatus {
  id: string;
  baseUrl: string;
  title: string;
  pages: PageStatus[];
}

export interface StatusCheckData {
  siteStatuses: SiteStatus[];
  people: string[];
  lastUpdated: string;
}

export class StatusCheckManager {
  private storageKey = 'accessibility-status-check';
  private peopleKey = 'accessibility-status-people';

  initializeSiteStatuses(sites: Array<{ id: string; baseUrl: string; title: string; pages: Array<{ url: string; title: string }> }>) {
    const existing = this.getStatusData();
    
    if (existing && existing.siteStatuses.length > 0) {
      return; // Already initialized
    }

    const siteStatuses: SiteStatus[] = sites.map(site => ({
      id: site.id,
      baseUrl: site.baseUrl,
      title: site.title,
      pages: site.pages.map(page => ({
        url: page.url,
        title: page.title,
        isCompleted: false,
        completedBy: null,
        status: 'pending' as const,
        completedDate: null,
      })),
    }));

    const data: StatusCheckData = {
      siteStatuses,
      people: ['Noah', 'Abhi'],
      lastUpdated: new Date().toLocaleString(),
    };

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to initialize status:', error);
    }
  }

  getStatusData(): StatusCheckData | null {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to load status data:', error);
      return null;
    }
  }

  updatePageStatus(
    siteId: string,
    pageUrl: string,
    status: 'pending' | 'working' | 'completed',
    completedBy: string | null
  ): void {
    const data = this.getStatusData();
    if (!data) return;

    const site = data.siteStatuses.find(s => s.id === siteId);
    if (!site) return;

    const page = site.pages.find(p => p.url === pageUrl);
    if (!page) return;

    page.status = status;
    page.completedBy = completedBy;
    page.isCompleted = status === 'completed';
    page.completedDate = status === 'completed' ? new Date().toLocaleString() : null;

    // Auto-update site status if all pages completed
    const allPagesCompleted = site.pages.every(p => p.isCompleted);
    if (allPagesCompleted) {
      // Mark site as completed implicitly through pages
    }

    data.lastUpdated = new Date().toLocaleString();

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }

  addPerson(name: string): void {
    const data = this.getStatusData();
    if (!data) return;

    if (!data.people.includes(name)) {
      data.people.push(name);
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(data));
      } catch (error) {
        console.error('Failed to add person:', error);
      }
    }
  }

  getPeople(): string[] {
    const data = this.getStatusData();
    return data?.people || ['Noah', 'Abhi'];
  }

  getCompletionStats() {
    const data = this.getStatusData();
    if (!data) return { completedSites: 0, totalSites: 0, completedPages: 0, totalPages: 0 };

    let completedSites = 0;
    let totalSites = data.siteStatuses.length;
    let completedPages = 0;
    let totalPages = 0;

    data.siteStatuses.forEach(site => {
      const siteCompletedPages = site.pages.filter(p => p.isCompleted).length;
      const siteTotalPages = site.pages.length;

      totalPages += siteTotalPages;
      completedPages += siteCompletedPages;

      if (siteCompletedPages === siteTotalPages && siteTotalPages > 0) {
        completedSites++;
      }
    });

    return { completedSites, totalSites, completedPages, totalPages };
  }

  clearAllStatus(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to clear status:', error);
    }
  }
}

export const statusManager = new StatusCheckManager();