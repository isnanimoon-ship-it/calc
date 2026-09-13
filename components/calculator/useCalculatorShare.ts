"use client";

import { useEffect, useRef, useState } from "react";
import { decodeShareState } from "@/src/lib/share";

/** 현재 페이지의 canonical 형태 URL을 제공하고, 최초 진입 시 공유 상태를 한 번 복원한다. */
export function useCalculatorShare(onRestore: (state: unknown) => void): string {
  const restoreRef = useRef(onRestore);
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = new URL(window.location.href);
      const encoded = current.searchParams.get("s");
      current.search = "";
      current.hash = "";
      setBaseUrl(current.toString());
      if (!encoded) return;
      const state = decodeShareState(encoded);
      if (state !== null) restoreRef.current(state);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return baseUrl;
}

export function asShareRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
