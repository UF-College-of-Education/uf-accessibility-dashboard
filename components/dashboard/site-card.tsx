"use client";

import { useState } from "react";
import {
  ChevronDown,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  MessageSquare,
  Eye,
  ExternalLink,
  Zap,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { STATUS_OPTIONS, type SiteData, type TeamMember, type PageStatusType, type ScanResultData } from '@/app/components/GoogleSheetsService';
import type { SiteimproveData } from '@/app/components/SiteimproveService';
interface LocalStatus { status: PageStatusType; assignedTo: string; notes: string; updatedDate: string; }

interface SiteCardProps {
  site: SiteData;
  pageStatuses: Record<string, LocalStatus>;
  sitePriority: 1 | 2 | 3 | 4 | null;
  teamMembers: TeamMember[];
  onUpdateStatus: (pageUrl: string, status: PageStatusType) => void;
  onUpdateAssignment: (pageUrl: string, assignedTo: string) => void;
  onUpdatePriority: (siteId: string, priority: 1 | 2 | 3 | 4 | null) => void;
  onOpenNotes: (pageUrl: string, pageTitle: string) => void;
  onOpenReport: (pageUrl: string, pageTitle: string) => void;
  getScanData: (pageUrl: string) => ScanResultData | null;
  siteimproveData?: SiteimproveData | null;
  lighthouseScore?: number | null;
  lighthousePages?: Record<string, { score: number | null; status?: number }>;
}

const PRIORITY_CONFIG = {
  1: {
    label: "P1",
    full: "Critical",
    dotClass: "bg-red-500 shadow-red-500/50 shadow-sm",
    badgeClass: "bg-red-500/10 text-red-400 border-red-500/20",
    glowClass: "border-l-red-500",
  },
  2: {
    label: "P2",
    full: "High",
    dotClass: "bg-amber-500 shadow-amber-500/50 shadow-sm",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    glowClass: "border-l-amber-500",
  },
  3: {
    label: "P3",
    full: "Medium",
    dotClass: "bg-blue-500 shadow-blue-500/50 shadow-sm",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    glowClass: "border-l-blue-500",
  },
  4: {
    label: "P4",
    full: "Low",
    dotClass: "bg-slate-500",
    badgeClass: "bg-white/[0.04] text-muted-foreground border-white/[0.1]",
    glowClass: "border-l-slate-500",
  },
} as const;

function getStatusIcon(status: PageStatusType) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case "working":
      return <Clock className="w-4 h-4 text-blue-400 animate-pulse" />;
    case "issues":
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    case "archive-pending":
      return <Circle className="w-4 h-4 text-indigo-400" style={{ fill: "currentColor" }} />;
    case "archived":
      return <Circle className="w-4 h-4 text-rose-400" style={{ fill: "currentColor" }} />;
    default:
      return <Circle className="w-4 h-4 text-white/20" />;
  }
}

function getStatusBgColor(status: PageStatusType) {
  switch (status) {
    case "completed":
      return "bg-emerald-500/5 hover:bg-emerald-500/10";
    case "working":
      return "bg-blue-500/5 hover:bg-blue-500/10";
    case "issues":
      return "bg-amber-500/5 hover:bg-amber-500/10";
    case "archive-pending":
      return "bg-indigo-500/5 hover:bg-indigo-500/10";
    case "archived":
      return "bg-rose-500/5 hover:bg-rose-500/10";
    default:
      return "hover:bg-white/[0.04]";
  }
}

const PAGES_PER_BATCH = 30;

export default function SiteCard({
  site,
  pageStatuses,
  sitePriority,
  teamMembers,
  onUpdateStatus,
  onUpdateAssignment,
  onUpdatePriority,
  onOpenNotes,
  onOpenReport,
  getScanData,
  siteimproveData,
  lighthouseScore,
  lighthousePages,
}: SiteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGES_PER_BATCH);

  const completedInSite = site.pages.filter(
    (p) => pageStatuses[p.url]?.status === "completed"
  ).length;
  const progress = site.pages.length > 0 ? (completedInSite / site.pages.length) * 100 : 0;
  const priorityConfig = sitePriority ? PRIORITY_CONFIG[sitePriority] : null;

  // Count statuses
  const statusCounts = {
    completed: site.pages.filter((p) => pageStatuses[p.url]?.status === "completed").length,
    working: site.pages.filter((p) => pageStatuses[p.url]?.status === "working").length,
    issues: site.pages.filter((p) => pageStatuses[p.url]?.status === "issues").length,
  };

  return (
    <TooltipProvider>
      <div
        className={`rounded-xl border overflow-hidden transition-all duration-300 ${
          isExpanded
            ? "border-blue-500/20 glow-blue bg-white/[0.02]"
            : "border-white/[0.06] hover:border-white/[0.12] glass glass-hover"
        } ${priorityConfig ? `border-l-2 ${priorityConfig.glowClass}` : ""}`}
      >
        {/* Site Header */}
        <button
          type="button"
          className="w-full p-4 flex items-center gap-4 text-left transition-colors group"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          {/* Priority dot */}
          <div className="flex-shrink-0">
            <div className={`w-2.5 h-2.5 rounded-full ${priorityConfig?.dotClass ?? "bg-white/20"}`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-blue-400 transition-colors">
                {site.title}
              </h3>
              {priorityConfig && (
                <span className={`text-[10px] py-0.5 px-2 rounded-full font-medium border ${priorityConfig.badgeClass}`}>
                  {priorityConfig.label} {priorityConfig.full}
                </span>
              )}
              {lighthouseScore != null && (
                <span className={`text-[10px] py-0.5 px-2 rounded-full font-mono font-medium border ${
                  lighthouseScore >= 90 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    : lighthouseScore >= 50 ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                    : "text-red-400 bg-red-500/10 border-red-500/20"
                }`}>
                  A11y: {lighthouseScore}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate font-mono">{site.baseUrl}</p>
          </div>

          {/* Status mini-pills + Progress */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Mini status counts */}
            <div className="hidden lg:flex items-center gap-1.5">
              {statusCounts.completed > 0 && (
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                  {statusCounts.completed} done
                </span>
              )}
              {statusCounts.working > 0 && (
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                  {statusCounts.working} active
                </span>
              )}
              {statusCounts.issues > 0 && (
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                  {statusCounts.issues} issues
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="hidden sm:flex items-center gap-3 min-w-[160px]">
              <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    progress === 100
                      ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                      : progress > 50
                        ? "bg-gradient-to-r from-blue-500 to-cyan-400"
                        : "bg-gradient-to-r from-blue-600 to-blue-500"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-mono w-12 text-right">
                {completedInSite}/{site.pages.length}
              </span>
            </div>

            {/* Priority selector */}
            <select style={{backgroundColor:'#1e293b',color:'#e2e8f0'}}
              value={sitePriority ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onUpdatePriority(site.id, v === "" ? null : (parseInt(v) as 1 | 2 | 3 | 4));
              }}
              onClick={(e) => e.stopPropagation()}
              className="hidden md:block text-xs rounded-lg px-2.5 py-1.5 bg-white/[0.04] text-foreground cursor-pointer hover:bg-white/[0.08] w-28 font-medium border border-white/[0.1] outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
              aria-label="Set priority"
            >
              <option style={{backgroundColor:'#1e293b',color:'#e2e8f0'}} value="">No Priority</option>
              <option style={{backgroundColor:'#1e293b',color:'#e2e8f0'}} value="1">P1 - Critical</option>
              <option style={{backgroundColor:'#1e293b',color:'#e2e8f0'}} value="2">P2 - High</option>
              <option style={{backgroundColor:'#1e293b',color:'#e2e8f0'}} value="3">P3 - Medium</option>
              <option style={{backgroundColor:'#1e293b',color:'#e2e8f0'}} value="4">P4 - Low</option>
            </select>

            <ChevronDown
              className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${
                isExpanded ? "rotate-180 text-blue-400" : ""
              }`}
            />
          </div>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-white/[0.06]">
            {/* Mobile progress */}
            <div className="sm:hidden p-4 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      progress === 100
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                        : "bg-gradient-to-r from-blue-500 to-cyan-400"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {completedInSite}/{site.pages.length}
                </span>
              </div>
            </div>

            <div className="p-3">
              <div className="space-y-0.5">
                {site.pages.slice(0, visibleCount).map((page) => {
                  const status = pageStatuses[page.url] || {
                    status: "not-started" as PageStatusType,
                    assignedTo: "",
                    notes: "",
                    updatedDate: "",
                  };
                  const hasNotes = !!status.notes;
                  const scanData = getScanData(page.url);

                  // Siteimprove issue lookup
                  const siPage = siteimproveData?.pages?.[page.url]
                    || siteimproveData?.pages?.[page.url.replace(/\/$/, '')]
                    || null;

                  // Lighthouse per-page score
                  const lhData = lighthousePages?.[page.url] ?? lighthousePages?.[page.url.replace(/\/$/, '')] ?? null;
                  const lhScore = lhData?.score ?? null;
                  const lhStatus = lhData?.status;

                  return (
                    <div
                      key={page.url}
                      className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors duration-150 group ${getStatusBgColor(status.status)}`}
                    >
                      {/* Status icon */}
                      <div className="flex-shrink-0">{getStatusIcon(status.status)}</div>

                      {/* Page info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{page.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate font-mono">{page.url}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {status.assignedTo && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full">
                              <Zap className="w-2.5 h-2.5" />
                              {status.assignedTo}
                            </span>
                          )}
                          {siPage && (
                            <>
                              <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${
                                siPage.aIssues > 0
                                  ? "text-red-400 bg-red-500/10 border-red-500/20"
                                  : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                              }`}>
                                A: {siPage.aIssues}
                              </span>
                              <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${
                                siPage.aaIssues > 0
                                  ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                  : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                              }`}>
                                AA: {siPage.aaIssues}
                              </span>
                              <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${
                                siPage.ariaIssues > 0
                                  ? "text-purple-400 bg-purple-500/10 border-purple-500/20"
                                  : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                              }`}>
                                ARIA: {siPage.ariaIssues}
                              </span>
                            </>
                          )}
                          {lhStatus === 404 || lhScore === 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full border text-gray-400 bg-gray-500/10 border-gray-500/20">
                              404
                            </span>
                          ) : lhScore != null ? (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${
                              lhScore >= 90
                                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                : lhScore >= 50
                                ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                : "text-red-400 bg-red-500/10 border-red-500/20"
                            }`}>
                              LH: {lhScore}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onOpenNotes(page.url, page.title)}
                              className={`p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors ${
                                hasNotes ? "text-blue-400" : "text-muted-foreground"
                              }`}
                              aria-label={hasNotes ? "View notes" : "Add notes"}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{hasNotes ? "View Notes" : "Add Notes"}</TooltipContent>
                        </Tooltip>

                        {scanData && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => onOpenReport(page.url, page.title)}
                                className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors text-muted-foreground hover:text-emerald-400"
                                aria-label="View report"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>View Report</TooltipContent>
                          </Tooltip>
                        )}

                        <a
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors text-muted-foreground hover:text-blue-400"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Open page"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <select style={{backgroundColor:'#1e293b',color:'#e2e8f0'}}
                          value={status.assignedTo}
                          onChange={(e) => onUpdateAssignment(page.url, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] rounded-md px-1.5 py-1 bg-white/[0.04] text-foreground cursor-pointer hover:bg-white/[0.08] w-20 font-medium border border-white/[0.08] outline-none focus:ring-1 focus:ring-blue-500/30"
                          aria-label="Assign to"
                        >
                          <option style={{backgroundColor:'#1e293b',color:'#e2e8f0'}} value="">Assign</option>
                          {teamMembers.map((m) => (
                            <option style={{backgroundColor:'#1e293b',color:'#e2e8f0'}} key={m.name} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </select>

                        <select style={{backgroundColor:'#1e293b',color:'#e2e8f0'}}
                          value={status.status}
                          onChange={(e) => onUpdateStatus(page.url, e.target.value as PageStatusType)}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] rounded-md px-1.5 py-1 bg-white/[0.04] text-foreground cursor-pointer hover:bg-white/[0.08] w-24 font-medium border border-white/[0.08] outline-none focus:ring-1 focus:ring-blue-500/30"
                          aria-label="Set status"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option style={{backgroundColor:'#1e293b',color:'#e2e8f0'}} key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More / Show Less buttons for sites with many pages */}
              {site.pages.length > PAGES_PER_BATCH && (
                <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-white/[0.06]">
                  {visibleCount < site.pages.length && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => Math.min(prev + PAGES_PER_BATCH, site.pages.length))}
                      className="px-4 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
                    >
                      Load More ({Math.min(PAGES_PER_BATCH, site.pages.length - visibleCount)} of {site.pages.length - visibleCount} remaining)
                    </button>
                  )}
                  {visibleCount > PAGES_PER_BATCH && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount(PAGES_PER_BATCH)}
                      className="px-4 py-1.5 text-xs font-medium text-muted-foreground bg-white/[0.04] border border-white/[0.08] rounded-lg hover:bg-white/[0.08] transition-colors"
                    >
                      Show Less
                    </button>
                  )}
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Showing {Math.min(visibleCount, site.pages.length)}/{site.pages.length} pages
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}