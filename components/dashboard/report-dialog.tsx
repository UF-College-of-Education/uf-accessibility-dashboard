"use client";

import { FileText, AlertCircle, AlertTriangle, Info, MinusCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ScanResultData } from '@/app/components/GoogleSheetsService';

interface ReportDialogProps {
  isOpen: boolean;
  pageTitle: string;
  scanData: ScanResultData | null;
  onClose: () => void;
}

function ScoreRing({ label, value, size = 90 }: { label: string; value: number; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 90 ? "#10b981" : value >= 50 ? "#f59e0b" : "#ef4444";
  const bgColor = value >= 90 ? "rgba(16,185,129,0.1)" : value >= 50 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";
  const textColor = value >= 90 ? "text-emerald-400" : value >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill={bgColor}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="6"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000"
            style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-xl font-bold font-mono ${textColor}`}>
          {value}
        </span>
      </div>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

export default function ReportDialog({ isOpen, pageTitle, scanData, onClose }: ReportDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-[hsl(222,47%,14%)] border-white/[0.1]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-foreground">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
              <FileText className="w-3.5 h-3.5 text-white" />
            </div>
            Scan Report
          </DialogTitle>
          <DialogDescription className="truncate text-xs font-mono text-muted-foreground">
            {pageTitle}
          </DialogDescription>
        </DialogHeader>

        {scanData ? (
          <div className="space-y-6">
            {/* Lighthouse Scores */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">
                Lighthouse Scores
              </h4>
              <div className="flex items-center justify-around">
                <ScoreRing label="Performance" value={scanData.lighthousePerformance} />
                <ScoreRing label="Accessibility" value={scanData.lighthouseAccessibility} />
                <ScoreRing label="Best Practices" value={scanData.lighthouseBestPractices} />
                <ScoreRing label="SEO" value={scanData.lighthouseSeo} />
              </div>
            </div>

            {/* Issues Breakdown */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Accessibility Issues
              </h4>
              <div className="grid grid-cols-5 gap-3">
                {[
                  {
                    label: "Total",
                    value: scanData.totalIssues,
                    icon: <Info className="w-4 h-4" />,
                    colorClass: "text-blue-400",
                    bgClass: "bg-blue-500/10",
                  },
                  {
                    label: "Critical",
                    value: scanData.criticalCount,
                    icon: <AlertCircle className="w-4 h-4" />,
                    colorClass: "text-red-400",
                    bgClass: "bg-red-500/10",
                  },
                  {
                    label: "Serious",
                    value: scanData.seriousCount,
                    icon: <AlertTriangle className="w-4 h-4" />,
                    colorClass: "text-amber-400",
                    bgClass: "bg-amber-500/10",
                  },
                  {
                    label: "Moderate",
                    value: scanData.moderateCount,
                    icon: <Info className="w-4 h-4" />,
                    colorClass: "text-blue-400",
                    bgClass: "bg-blue-500/10",
                  },
                  {
                    label: "Minor",
                    value: scanData.minorCount,
                    icon: <MinusCircle className="w-4 h-4" />,
                    colorClass: "text-slate-400",
                    bgClass: "bg-white/[0.04]",
                  },
                ].map((item) => (
                  <div key={item.label} className={`text-center rounded-lg p-3 ${item.bgClass}`}>
                    <div className={`flex justify-center mb-1 ${item.colorClass}`}>{item.icon}</div>
                    <div className={`text-2xl font-bold font-mono ${item.colorClass}`}>{item.value}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Scanned: {new Date(scanData.date).toLocaleString()}</span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
                {scanData.source === "auto" ? "Auto Scan" : "Manual Scan"}
              </span>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 w-10 h-10 opacity-30" />
            <p className="text-sm">No scan data available for this page.</p>
          </div>
        )}

        <DialogFooter>
          <Button
            size="sm"
            onClick={onClose}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
