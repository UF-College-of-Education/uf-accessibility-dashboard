"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Save, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface NotesDialogProps {
  isOpen: boolean;
  pageUrl: string;
  pageTitle: string;
  initialNotes: string;
  onClose: () => void;
  onSave: (pageUrl: string, notes: string) => void;
}

export default function NotesDialog({
  isOpen,
  pageUrl,
  pageTitle,
  initialNotes,
  onClose,
  onSave,
}: NotesDialogProps) {
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-[hsl(222,47%,14%)] border-white/[0.1]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-foreground">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500">
              <MessageSquare className="w-3.5 h-3.5 text-white" />
            </div>
            Page Notes
          </DialogTitle>
          <DialogDescription className="truncate text-xs font-mono text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-3 h-3" />
            {pageTitle}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this page..."
          className="min-h-[140px] text-sm resize-none bg-white/[0.04] border-white/[0.08] text-foreground placeholder:text-muted-foreground focus:border-blue-500/40"
        />
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20"
            onClick={() => onSave(pageUrl, notes)}
          >
            <Save className="w-3.5 h-3.5" />
            Save Notes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
