"use client";

import { useCallback } from "react";
import { useToast } from "@/providers/ToastProvider";

export function useCopyToClipboard() {
  const toast = useToast();

  return useCallback(
    async (text: string, successMessage = "Copied to clipboard") => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(successMessage);
      } catch {
        toast.error("Could not copy. Please copy it manually.");
      }
    },
    [toast],
  );
}
