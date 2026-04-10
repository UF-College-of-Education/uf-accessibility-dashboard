"use client";

import React, { useEffect, useState } from "react";
import { Palette, Layers, TrendingUp } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number;
  total: number;
  icon: React.ReactNode;
  gradient: string;
  glowClass: string;
  delay: number;
}

function AnimatedNumber({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (target === 0) return;
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCurrent(target);
        clearInterval(timer);
      } else {
        setCurrent(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);

  return <>{current}</>;
}

function StatCard({ label, value, total, icon, gradient, glowClass, delay }: StatCardProps) {
  const pct = total > 0 ? (value / total) * 100 : 0;

  return (
    <div
      className={`animate-fade-in-up relative overflow-hidden rounded-xl border border-white/[0.06] ${glowClass} transition-all duration-500 hover:scale-[1.02] hover:border-white/[0.12]`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 opacity-[0.08] ${gradient}`} />
      <div className="absolute inset-0 animate-shimmer" />

      <div className="relative p-5">
        <div className="flex items-start justify-between mb-5">
          <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${gradient} shadow-lg`}>
            {icon}
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold tracking-tight text-foreground font-mono">
              <AnimatedNumber target={value} />
            </span>
            <span className="text-base text-muted-foreground font-mono">/{total}</span>
          </div>
        </div>

        <p className="text-sm font-medium text-muted-foreground mb-4">{label}</p>

        {/* Progress bar */}
        <div className="relative w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full ${gradient} transition-all duration-1000 ease-out ${pct > 0 && pct < 100 ? "animate-progress-stripe" : ""}`}
            style={{ width: `${pct}%`, transitionDelay: `${delay + 300}ms` }}
          />
        </div>

        <div className="flex items-center justify-between mt-2.5">
          <p className="text-xs text-muted-foreground font-mono">{pct.toFixed(1)}% complete</p>
          {pct > 0 && (
            <div className="flex items-center gap-1 text-emerald-400 text-xs">
              <TrendingUp className="w-3 h-3" />
              <span className="font-medium">Active</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatCardsProps {
  completedSites: number;
  totalSites: number;
  completedPages: number;
  totalPages: number;
  diviCompletedSites: number;
  diviTotalSites: number;
  diviCompletedPages: number;
  diviTotalPages: number;
  enfoldCompletedSites: number;
  enfoldTotalSites: number;
  enfoldCompletedPages: number;
  enfoldTotalPages: number;
}

export default function StatCards({
  completedSites,
  totalSites,
  completedPages,
  totalPages,
  diviCompletedSites,
  diviTotalSites,
  diviCompletedPages,
  diviTotalPages,
  enfoldCompletedSites,
  enfoldTotalSites,
  enfoldCompletedPages,
  enfoldTotalPages,
}: StatCardsProps) {
  return (
    <div className="space-y-4">
      {/* Divi & Enfold */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Divi Sites Completed"
          value={diviCompletedSites}
          total={diviTotalSites}
          icon={<Palette className="w-5 h-5 text-white" />}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
          glowClass="glow-emerald"
          delay={200}
        />
        <StatCard
          label="Divi Pages Completed"
          value={diviCompletedPages}
          total={diviTotalPages}
          icon={<Palette className="w-5 h-5 text-white" />}
          gradient="bg-gradient-to-br from-emerald-600 to-teal-600"
          glowClass="glow-emerald"
          delay={250}
        />
        <StatCard
          label="Enfold Sites Completed"
          value={enfoldCompletedSites}
          total={enfoldTotalSites}
          icon={<Layers className="w-5 h-5 text-white" />}
          gradient="bg-gradient-to-br from-red-500 to-rose-500"
          glowClass="glow-rose"
          delay={300}
        />
        <StatCard
          label="Enfold Pages Completed"
          value={enfoldCompletedPages}
          total={enfoldTotalPages}
          icon={<Layers className="w-5 h-5 text-white" />}
          gradient="bg-gradient-to-br from-red-600 to-rose-600"
          glowClass="glow-rose"
          delay={350}
        />
      </div>
    </div>
  );
}
