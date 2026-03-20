"use client";

import React from "react";
import { CheckCircle2, Circle, Clock, AlertTriangle, Ban } from "lucide-react";
import type { PageStatusType } from '@/app/components/GoogleSheetsService';

const LEGEND_ITEMS: {
  status: PageStatusType;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
}[] = [
  {
    status: "not-started",
    label: "Not Started",
    icon: <Circle className="w-3.5 h-3.5" />,
    colorClass: "text-white/30 bg-white/[0.04]",
  },
  {
    status: "working",
    label: "In Progress",
    icon: <Clock className="w-3.5 h-3.5" />,
    colorClass: "text-blue-400 bg-blue-500/10",
  },
  {
    status: "completed",
    label: "Completed",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    colorClass: "text-emerald-400 bg-emerald-500/10",
  },
  {
    status: "issues",
    label: "Has Issues",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    colorClass: "text-amber-400 bg-amber-500/10",
  },
  {
    status: "archive-pending",
    label: "Archive Pending",
    icon: <Circle className="w-3.5 h-3.5" style={{ fill: "currentColor" }} />,
    colorClass: "text-indigo-400 bg-indigo-500/10",
  },
  {
    status: "archived",
    label: "Archived",
    icon: <Circle className="w-3.5 h-3.5" style={{ fill: "currentColor" }} />,
    colorClass: "text-rose-400 bg-rose-500/10",
  },
  {
    status: "404",
    label: "404 - Not Found",
    icon: <Ban className="w-3.5 h-3.5" />,
    colorClass: "text-gray-400 bg-gray-500/10",
  },
];

export default function StatusLegend() {
  return (
    <div className="animate-fade-in-up flex flex-wrap items-center gap-2 px-1 py-4" style={{ animationDelay: "800ms" }}>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-2">Legend</span>
      {LEGEND_ITEMS.map((item) => (
        <div
          key={item.status}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-white/[0.06] ${item.colorClass}`}
        >
          {item.icon}
          <span className="font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
