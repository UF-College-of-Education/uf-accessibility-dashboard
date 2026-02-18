'use client';

import { useState, useEffect } from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import { fetchSites, Site } from '../components/DataService';
import TeamProgress from '@/components/dashboard/team-progress';
import BallCursor from '@/components/ball-cursor';
import InteractiveBackground from '@/components/interactive-background';
import {
  PageStatusType,
  TeamMember,
  SiteData,
  getTeamMembersLocal,
  getAllPageStatusesLocal,
  fetchAllDataFromSheet,
  mergeSheetDataIntoLocal,
} from '../components/GoogleSheetsService';

interface LocalStatus {
  status: PageStatusType;
  assignedTo: string;
  notes: string;
  updatedDate: string;
}

export default function TeamProgressPage() {
  const [sites, setSites] = useState<SiteData[]>([]);
  const [pageStatuses, setPageStatuses] = useState<Record<string, LocalStatus>>({});
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Load cloud data first (same as StatusCheckPage)
        const sheetData = await fetchAllDataFromSheet();
        if (sheetData.success && Object.keys(sheetData.statuses).length > 0) {
          mergeSheetDataIntoLocal(sheetData.statuses);
        }

        // Load sites
        const fetchedSites = await fetchSites();
        const siteData: SiteData[] = fetchedSites.map((s: Site) => ({
          id: s.id,
          title: s.title,
          baseUrl: s.baseUrl,
          pages: s.pages.map(p => ({ title: p.title, url: p.url })),
        }));
        setSites(siteData);

        // Load statuses and team members from localStorage
        const statuses = getAllPageStatusesLocal();
        const members = getTeamMembersLocal();

        setPageStatuses(statuses);
        setTeamMembers(members);
      } catch (error) {
        console.error('Error loading team progress data:', error);
        // Fallback to local data
        const statuses = getAllPageStatusesLocal();
        const members = getTeamMembersLocal();
        setPageStatuses(statuses);
        setTeamMembers(members);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
          <span className="text-sm text-muted-foreground">Loading team progress...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <BallCursor />
      <InteractiveBackground />
      <div className="relative z-10 min-h-screen bg-transparent" style={{ cursor: 'none' }}>
        {/* Header */}
        <header className="relative overflow-hidden border-b border-white/[0.06]">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 via-transparent to-teal-600/5" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center gap-4 mb-2">
              <a
                href="/status"
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] transition-colors"
                title="Back to Status Dashboard"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </a>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25 animate-float">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-400 tracking-widest uppercase mb-0.5">
                  UF College of Education
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
                  Team Progress Dashboard
                </h1>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1 ml-[88px] max-w-xl leading-relaxed">
              View team member progress, daily completions, and completed page URLs
            </p>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <TeamProgress
            pageStatuses={pageStatuses}
            teamMembers={teamMembers}
            sites={sites}
            fullPage
          />
        </main>
      </div>
    </>
  );
}
