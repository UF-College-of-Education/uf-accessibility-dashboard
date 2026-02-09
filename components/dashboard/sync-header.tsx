"use client";

import {
  RefreshCw,
  Upload,
  ExternalLink,
  Check,
  Cloud,
  CloudOff,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SyncHeaderProps {
  cloudStatus: "loading" | "connected" | "offline";
  lastSyncTime: string;
  exporting: boolean;
  exportSuccess: boolean;
  loading: boolean;
  searchQuery: string;
  onRefresh: () => void;
  onExport: () => void;
  onSearchChange: (query: string) => void;
}

export default function SyncHeader({
  cloudStatus,
  lastSyncTime,
  exporting,
  exportSuccess,
  loading,
  searchQuery,
  onRefresh,
  onExport,
  onSearchChange,
}: SyncHeaderProps) {
  return (
    <div className="animate-fade-in-up flex flex-col gap-4" style={{ animationDelay: "500ms" }}>
      {/* Connected banner */}
      <div className="flex items-center justify-between flex-wrap gap-3 rounded-xl glass p-4 border border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full ${
              cloudStatus === "connected"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : cloudStatus === "loading"
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  : "bg-white/[0.06] text-muted-foreground border border-white/[0.1]"
            }`}
          >
            {cloudStatus === "connected" ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                Connected
              </>
            ) : cloudStatus === "loading" ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" /> Syncing
              </>
            ) : (
              <>
                <CloudOff className="w-3 h-3" /> Offline
              </>
            )}
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Last sync: {lastSyncTime}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-foreground"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            className={`h-8 gap-1.5 text-xs ${
              exportSuccess
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-foreground"
            }`}
            onClick={onExport}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : exportSuccess ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {exporting ? "Exporting..." : exportSuccess ? "Exported!" : "Export"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-foreground"
            asChild
          >
            <a
              href="https://docs.google.com/spreadsheets/d/1ntgfO0PeVULOCA-Q1eLfoEJwW-izHlPpP1FvWvVk2UM/edit"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open Sheet</span>
            </a>
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-sm" />
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-400 transition-colors" />
          <Input
            placeholder="Search sites by name or URL..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-10 text-sm bg-white/[0.04] border-white/[0.08] text-foreground placeholder:text-muted-foreground focus:border-blue-500/40 focus:bg-white/[0.06] transition-all"
          />
          <Sparkles className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
        </div>
      </div>
    </div>
  );
}
