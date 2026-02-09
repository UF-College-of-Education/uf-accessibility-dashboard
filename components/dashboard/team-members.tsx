"use client";

import { useState } from "react";
import { Users, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TeamMember } from '@/app/components/GoogleSheetsService';

interface TeamMembersProps {
  members: TeamMember[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}

const AVATAR_GRADIENTS = [
  "from-blue-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-amber-500 to-orange-400",
  "from-rose-500 to-pink-400",
  "from-indigo-500 to-blue-400",
  "from-fuchsia-500 to-pink-400",
];

export default function TeamMembers({ members, onAdd, onRemove }: TeamMembersProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  function handleAdd() {
    if (!newName.trim()) return;
    onAdd(newName.trim());
    setNewName("");
    setShowAdd(false);
  }

  return (
    <div className="animate-fade-in-up rounded-xl border border-white/[0.06] glass p-5" style={{ animationDelay: "400ms" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500">
            <Users className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Team Members</h3>
          <span className="text-xs font-mono text-muted-foreground bg-white/[0.06] px-2 py-0.5 rounded-full">
            {members.length}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-foreground"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>

      {showAdd && (
        <div className="flex gap-2 mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/[0.06] animate-scale-in">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter name..."
            className="h-8 text-sm bg-white/[0.04] border-white/[0.1] text-foreground placeholder:text-muted-foreground"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button size="sm" className="h-8 text-xs bg-blue-500 hover:bg-blue-600 text-white" onClick={handleAdd}>
            Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
            onClick={() => setShowAdd(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {members.map((member, idx) => (
          <div
            key={member.name}
            className="group flex items-center gap-2 py-1.5 px-3 rounded-full bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.08] transition-all duration-200 cursor-default animate-slide-in-right"
            style={{ animationDelay: `${500 + idx * 60}ms` }}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br ${
                AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]
              } shadow-sm`}
            >
              {member.name.charAt(0).toUpperCase()}
            </span>
            <span className="text-xs font-medium text-foreground">{member.name}</span>
            <button
              type="button"
              onClick={() => onRemove(member.name)}
              className="opacity-0 group-hover:opacity-100 transition-opacity -mr-1 text-muted-foreground hover:text-rose-400"
              aria-label={`Remove ${member.name}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
