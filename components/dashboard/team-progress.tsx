"use client";

import { useState, useMemo } from "react";
import {
  Users,
  TrendingUp,
  Calendar,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  BarChart3,
} from "lucide-react";
import type { TeamMember, PageStatusType, SiteData } from "@/app/components/GoogleSheetsService";

interface LocalStatus {
  status: PageStatusType;
  assignedTo: string;
  notes: string;
  updatedDate: string;
}

interface TeamProgressProps {
  pageStatuses: Record<string, LocalStatus>;
  teamMembers: TeamMember[];
  sites: SiteData[];
  fullPage?: boolean;
}

interface UserStats {
  name: string;
  completed: number;
  working: number;
  issues: number;
  total: number;
  completedPages: { url: string; title: string; site: string; date: string }[];
}

const AVATAR_GRADIENTS = [
  "from-blue-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-amber-500 to-orange-400",
  "from-rose-500 to-pink-400",
  "from-indigo-500 to-blue-400",
  "from-fuchsia-500 to-pink-400",
];

function formatDate(isoStr: string): string {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

function getDateKey(isoStr: string): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return d.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

export default function TeamProgress({ pageStatuses, teamMembers, sites, fullPage = false }: TeamProgressProps) {
  const [isExpanded, setIsExpanded] = useState(fullPage);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Build a URL -> { title, site } lookup from sites data
  const urlInfo = useMemo(() => {
    const map: Record<string, { title: string; site: string }> = {};
    for (const site of sites) {
      for (const page of site.pages) {
        map[page.url] = { title: page.title, site: site.title };
      }
    }
    return map;
  }, [sites]);

  // Calculate per-user stats
  const userStats = useMemo(() => {
    const statsMap: Record<string, UserStats> = {};

    // Init all team members
    for (const member of teamMembers) {
      statsMap[member.name] = {
        name: member.name,
        completed: 0,
        working: 0,
        issues: 0,
        total: 0,
        completedPages: [],
      };
    }

    // Process all page statuses
    for (const [url, status] of Object.entries(pageStatuses)) {
      const user = status.assignedTo;
      if (!user) continue;

      // Create entry for users not in team list
      if (!statsMap[user]) {
        statsMap[user] = {
          name: user,
          completed: 0,
          working: 0,
          issues: 0,
          total: 0,
          completedPages: [],
        };
      }

      statsMap[user].total++;

      if (status.status === "completed") {
        statsMap[user].completed++;
        const info = urlInfo[url] || { title: url.split("/").filter(Boolean).pop() || "Page", site: "Unknown" };
        statsMap[user].completedPages.push({
          url,
          title: info.title,
          site: info.site,
          date: status.updatedDate,
        });
      } else if (status.status === "working") {
        statsMap[user].working++;
      } else if (status.status === "issues") {
        statsMap[user].issues++;
      }
    }

    // Sort completed pages by date (newest first) for each user
    for (const stats of Object.values(statsMap)) {
      stats.completedPages.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    }

    // Sort users by completed count (descending)
    return Object.values(statsMap)
      .filter((s) => s.total > 0 || teamMembers.some((m) => m.name === s.name))
      .sort((a, b) => b.completed - a.completed);
  }, [pageStatuses, teamMembers, urlInfo]);

  // Daily completions (last 5 calendar days)
  const dailyData = useMemo(() => {
    const dailyMap: Record<string, Record<string, number>> = {};

    for (const [, status] of Object.entries(pageStatuses)) {
      if (status.status !== "completed" || !status.assignedTo || !status.updatedDate) continue;
      const dateKey = getDateKey(status.updatedDate);
      if (!dateKey) continue;

      if (!dailyMap[dateKey]) dailyMap[dateKey] = {};
      if (!dailyMap[dateKey][status.assignedTo]) dailyMap[dateKey][status.assignedTo] = 0;
      dailyMap[dateKey][status.assignedTo]++;
    }

    // Always show exactly last 5 calendar days, even if no activity
    const dates: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }

    return { dailyMap, dates };
  }, [pageStatuses]);

  // Get unique users who have completions
  const activeUsers = useMemo(() => {
    return userStats.filter((u) => u.completed > 0 || u.working > 0 || u.issues > 0);
  }, [userStats]);

  const totalCompleted = userStats.reduce((sum, u) => sum + u.completed, 0);

  if (teamMembers.length === 0 && activeUsers.length === 0) return null;

  return (
    <div
      className={`animate-fade-in-up rounded-xl border border-white/[0.06] glass overflow-hidden ${fullPage ? "" : ""}`}
      style={{ animationDelay: fullPage ? "0ms" : "450ms" }}
    >
      {/* Header - collapsible in embedded mode, static in full-page mode */}
      {fullPage ? (
        <div className="p-5 flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">Team Progress</h2>
            <p className="text-sm text-muted-foreground">
              {totalCompleted} pages completed by {activeUsers.length} members
            </p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="w-full p-5 flex items-center gap-4 text-left transition-colors hover:bg-white/[0.02]"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Team Progress</h3>
            <p className="text-xs text-muted-foreground">
              {totalCompleted} pages completed by {activeUsers.length} members
            </p>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${
              isExpanded ? "rotate-180 text-emerald-400" : ""
            }`}
          />
        </button>
      )}

      {isExpanded && (
        <div className="border-t border-white/[0.06] p-5 space-y-6">
          {/* ===== SECTION 1: User Stat Cards ===== */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-blue-400" />
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Member Overview</h4>
            </div>
            <div className="space-y-3">
              {/* User cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {userStats.map((user, idx) => {
                  const pct = user.total > 0 ? (user.completed / user.total) * 100 : 0;
                  const isUserExpanded = expandedUser === user.name;

                  return (
                    <button
                      key={user.name}
                      type="button"
                      onClick={() => setExpandedUser(isUserExpanded ? null : user.name)}
                      className={`w-full text-left rounded-xl border p-4 transition-all duration-200 hover:border-white/[0.15] ${
                        isUserExpanded
                          ? "border-emerald-500/30 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br ${
                            AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]
                          } shadow-sm`}
                        >
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {user.completed} completed
                          </p>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-muted-foreground transition-transform ${
                            isUserExpanded ? "rotate-180 text-emerald-400" : ""
                          }`}
                        />
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-2 mb-2.5">
                        {user.completed > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                            <CheckCircle2 className="w-2.5 h-2.5 inline mr-0.5" />
                            {user.completed}
                          </span>
                        )}
                        {user.working > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                            <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                            {user.working}
                          </span>
                        )}
                        {user.issues > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                            <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />
                            {user.issues}
                          </span>
                        )}
                        {user.total === 0 && (
                          <span className="text-[10px] text-muted-foreground">No pages assigned</span>
                        )}
                      </div>

                      {/* Progress bar */}
                      {user.total > 0 && (
                        <div>
                          <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                pct === 100
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                                  : "bg-gradient-to-r from-blue-500 to-cyan-400"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono mt-1">
                            {pct.toFixed(0)}% — {user.completed}/{user.total} pages
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ===== Expanded: Completed URLs — rendered OUTSIDE the grid so it spans full width ===== */}
              {expandedUser && (() => {
                const user = userStats.find((u) => u.name === expandedUser);
                if (!user || user.completedPages.length === 0) return null;

                return (
                  <div className="rounded-xl border border-emerald-500/20 bg-white/[0.01] overflow-hidden animate-scale-in">
                    <div className="p-3 border-b border-white/[0.06] flex items-center gap-2 bg-emerald-500/5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-semibold text-foreground">
                        {user.name}'s Completed Pages ({user.completedPages.length})
                      </span>
                    </div>
                    <div className={`${fullPage ? "max-h-[70vh]" : "max-h-80"} overflow-y-auto`}>
                      {user.completedPages.map((page) => (
                        <div
                          key={page.url}
                          className="flex items-center gap-3 px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors group"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{page.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate font-mono">{page.url}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">{page.site}</span>
                              <span className="text-[10px] text-muted-foreground">•</span>
                              <span className="text-[10px] text-emerald-400">{formatDate(page.date)}</span>
                            </div>
                          </div>
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-white/[0.08] text-muted-foreground hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ===== SECTION 2: Daily Activity Table ===== */}
          <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Daily Completions (Last 5 Days)
                </h4>
              </div>
              <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                        <th className="text-left p-3 font-semibold text-foreground sticky left-0 bg-[#0a0a0a] z-10 min-w-[100px]">
                          Date
                        </th>
                        {activeUsers.map((user, idx) => (
                          <th key={user.name} className="p-3 font-semibold text-foreground text-center min-w-[80px]">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white bg-gradient-to-br ${
                                  AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]
                                }`}
                              >
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="truncate max-w-[70px]">{user.name}</span>
                            </div>
                          </th>
                        ))}
                        <th className="p-3 font-semibold text-foreground text-center min-w-[60px]">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyData.dates.map((dateKey) => {
                        const dayData = dailyData.dailyMap[dateKey] || {};
                        const dayTotal = Object.values(dayData).reduce((s, n) => s + n, 0);
                        const isToday = dateKey === new Date().toISOString().split("T")[0];

                        return (
                          <tr
                            key={dateKey}
                            className={`border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors ${
                              isToday ? "bg-blue-500/5" : ""
                            }`}
                          >
                            <td className="p-3 font-mono text-muted-foreground sticky left-0 bg-[#0a0a0a] z-10">
                              <div className="flex items-center gap-2">
                                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
                                {formatDate(dateKey + "T00:00:00")}
                              </div>
                            </td>
                            {activeUsers.map((user) => {
                              const count = dayData[user.name] || 0;
                              return (
                                <td key={user.name} className="p-3 text-center">
                                  {count > 0 ? (
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold font-mono">
                                      {count}
                                    </span>
                                  ) : (
                                    <span className="text-white/10">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="p-3 text-center">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 font-bold font-mono">
                                {dayTotal}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Totals row */}
                    <tfoot>
                      <tr className="border-t border-white/[0.08] bg-white/[0.02]">
                        <td className="p-3 font-semibold text-foreground sticky left-0 bg-[#0a0a0a] z-10">
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                            Total
                          </div>
                        </td>
                        {activeUsers.map((user) => (
                          <td key={user.name} className="p-3 text-center">
                            <span className="font-bold font-mono text-emerald-400">{user.completed}</span>
                          </td>
                        ))}
                        <td className="p-3 text-center">
                          <span className="font-bold font-mono text-blue-400">{totalCompleted}</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
        </div>
      )}
    </div>
  );
}
