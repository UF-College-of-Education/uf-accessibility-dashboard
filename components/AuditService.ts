// app/components/AuditService.ts

export interface AuditIssue {
  type: 'error' | 'warning';
  code: string;
  message: string;
  wcagPrinciple: string;
  selector: string;
  codeSnippet: string;
  recommendation?: string;
}

export interface LighthouseScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

export interface LighthousePerformanceIssue {
  title: string;
  description: string;
  score: number;
  displayValue?: string;
  recommendation: string;
}

export interface LighthouseAccessibilityIssue {
  title: string;
  description: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  nodes: Array<{
    html: string;
    target: string;
  }>;
  recommendation: string;
}

export interface LighthouseBestPracticesIssue {
  title: string;
  description: string;
  recommendation: string;
}

export interface LighthouseSEOIssue {
  title: string;
  description: string;
  recommendation: string;
}

export interface AuditPageResult {
  url: string;
  title: string;
  status: 'success' | 'error';
  issues: AuditIssue[];
  timestamp: number;
  lighthouseScores?: LighthouseScores;
  lighthousePerformanceIssues?: LighthousePerformanceIssue[];
  lighthouseAccessibilityIssues?: LighthouseAccessibilityIssue[];
  lighthouseBestPracticesIssues?: LighthouseBestPracticesIssue[];
  lighthouseSEOIssues?: LighthouseSEOIssue[];
}

export interface AuditRun {
  id: string;
  timestamp: number;
  dateString: string;
  siteCount: number;
  pageCount: number;
  totalIssues: number;
  results: AuditPageResult[];
}

export class AuditHistoryManager {
  private storageKey = 'accessibility-audit-history';

  saveAuditRun(results: AuditPageResult[], siteCount: number): AuditRun {
    const now = Date.now();
    const auditRun: AuditRun = {
      id: `audit-${now}`,
      timestamp: now,
      dateString: new Date(now).toLocaleString(),
      siteCount,
      pageCount: results.length,
      totalIssues: results.reduce((sum, r) => sum + r.issues.length, 0),
      results,
    };

    const history = this.getHistory();
    history.unshift(auditRun);
    
    // Keep only last 20 audits
    if (history.length > 20) {
      history.pop();
    }

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save audit history:', error);
    }

    return auditRun;
  }

  getHistory(): AuditRun[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load audit history:', error);
      return [];
    }
  }

  getLatestRun(): AuditRun | null {
    const history = this.getHistory();
    return history.length > 0 ? history[0] : null;
  }

  getPreviousRun(): AuditRun | null {
    const history = this.getHistory();
    return history.length > 1 ? history[1] : null;
  }

  deleteRun(id: string): void {
    const history = this.getHistory();
    const filtered = history.filter(run => run.id !== id);
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to delete audit:', error);
    }
  }

  clearHistory(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  }
}

export const auditManager = new AuditHistoryManager();
