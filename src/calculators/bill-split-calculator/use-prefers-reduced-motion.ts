"use client";

/**
 * `prefers-reduced-motion: reduce` 구독 로컬 훅.
 *
 * ARCHITECTURE.md "5.4" — `playAnimation` 판단은 애니메이션 컴포넌트 내부가 아니라 `ui.tsx`
 * 한 곳에서 이 훅으로 계산해 props로 내려준다. 아직 두 번째 사용처가 없어 `src/lib/` 승격은
 * 보류한다(ARCHITECTURE.md "5.2"와 동일한 판단 기준).
 *
 * `window.matchMedia` 같은 브라우저 외부 상태 구독은 `useState`+`useEffect`로 직접 구현하면
 * "effect 안에서 곧바로 setState를 호출"하는 패턴이 되어(react-hooks/set-state-in-effect,
 * components/theme-toggle.tsx 주석이 이미 언급한 것과 동일한 문제) 불필요한 추가 렌더를
 * 유발할 수 있다 — 이런 외부 스토어 구독은 `useSyncExternalStore`가 정확히 의도된 용도이므로
 * 이를 사용한다. `window.matchMedia`가 없는 환경(일부 테스트 환경 등)에서도 안전하게 `false`를
 * 반환한다.
 */

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  try {
    return window.matchMedia(QUERY);
  } catch {
    return null;
  }
}

function subscribe(onStoreChange: () => void): () => void {
  const mediaQueryList = getMediaQueryList();
  if (!mediaQueryList) return () => {};
  // 구형 Safari(iOS 13 이하)는 addListener/removeListener만 지원한다.
  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", onStoreChange);
    return () => mediaQueryList.removeEventListener("change", onStoreChange);
  }
  mediaQueryList.addListener(onStoreChange);
  return () => mediaQueryList.removeListener(onStoreChange);
}

function getSnapshot(): boolean {
  return getMediaQueryList()?.matches ?? false;
}

/** 서버 렌더링 시점에는 사용자의 OS 설정을 알 수 없으므로 "축소 없음"을 기본값으로 둔다. */
function getServerSnapshot(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
