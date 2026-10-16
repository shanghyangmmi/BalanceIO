"use client";

import { useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SequenceGapBadgeProps {
  prefix: string; // e.g. "INV" or "BIL" or "JV"
  existingNumbers: string[]; // e.g. ["INV-001", "INV-003", "INV-004"]
  onSuggestNumber: (suggestedNo: string) => void;
}

export function SequenceGapBadge({
  prefix,
  existingNumbers,
  onSuggestNumber,
}: SequenceGapBadgeProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || !existingNumbers || existingNumbers.length < 2) return null;

  // Extract numbers to find smallest gap
  const numbers: number[] = [];
  const padLength = 3;

  existingNumbers.forEach((code) => {
    const match = code.match(/(\d+)$/);
    if (match) {
      numbers.push(parseInt(match[1], 10));
    }
  });

  numbers.sort((a, b) => a - b);

  let gapNumber: number | null = null;
  for (let i = 0; i < numbers.length - 1; i++) {
    if (numbers[i + 1] > numbers[i] + 1) {
      gapNumber = numbers[i] + 1;
      break;
    }
  }

  if (!gapNumber) return null;

  const formattedGapNo = `${prefix}-${gapNumber.toString().padStart(padLength, "0")}`;

  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-2xl text-xs text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <div>
          <span className="font-semibold">Sequence Gap Detected:</span> Number{" "}
          <span className="font-mono font-bold text-amber-700 dark:text-amber-300 underline">
            {formattedGapNo}
          </span>{" "}
          is unassigned. Would you like to use this number for your entry?
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onSuggestNumber(formattedGapNo);
            setIsDismissed(true);
          }}
          className="h-7 px-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs"
        >
          Use {formattedGapNo} <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-md"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
