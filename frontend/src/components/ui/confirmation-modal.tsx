"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2, Undo2, X, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  actionType: "delete" | "unpost" | "warning";
  itemReference?: string;
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  actionType,
  itemReference,
  isLoading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const isDelete = actionType === "delete";
  const isUnpost = actionType === "unpost";

  const getIcon = () => {
    if (isDelete) return <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />;
    if (isUnpost) return <Undo2 className="h-6 w-6 text-amber-600 dark:text-amber-400" />;
    return <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />;
  };

  const getHeaderBadge = () => {
    if (isDelete) {
      return (
        <div className="p-3 bg-red-100 dark:bg-red-950/50 rounded-2xl border border-red-200 dark:border-red-800/40">
          <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
      );
    }
    if (isUnpost) {
      return (
        <div className="p-3 bg-amber-100 dark:bg-amber-950/50 rounded-2xl border border-amber-200 dark:border-amber-800/40">
          <Undo2 className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
      );
    }
    return (
      <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl border">
        <ShieldAlert className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />
      </div>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl overflow-hidden"
        >
          {/* Top Close Button */}
          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col items-center text-center space-y-4">
            {getHeaderBadge()}

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-foreground font-display">{title}</h3>
              {itemReference && (
                <p className="text-xs font-mono px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-emerald-600 dark:text-emerald-400 inline-block font-semibold">
                  Ref: {itemReference}
                </p>
              )}
              <p className="text-sm text-muted-foreground leading-relaxed pt-1">{description}</p>
            </div>

            {/* Permission Restriction Notice */}
            {isDelete && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-xs font-medium border border-red-200 dark:border-red-900/40 w-full justify-center">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                <span>Restricted Action: Owner & Manager Authorization Only</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 rounded-xl h-11 border-zinc-200 dark:border-zinc-800"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  await onConfirm();
                  onClose();
                }}
                disabled={isLoading}
                className={
                  isDelete
                    ? "flex-1 rounded-xl h-11 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg shadow-red-600/20"
                    : "flex-1 rounded-xl h-11 bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-lg shadow-amber-600/20"
                }
              >
                {isLoading ? "Processing..." : isDelete ? "Confirm Delete" : "Confirm Unpost"}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
