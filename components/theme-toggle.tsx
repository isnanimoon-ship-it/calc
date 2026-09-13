"use client";

/**
 * 라이트/다크 모드 토글 버튼.
 * - 실제 클래스 적용은 app/layout.tsx의 인라인 스크립트가 hydration 이전에 먼저 수행한다
 *   (깜빡임 방지). 이 컴포넌트는 이후 사용자 토글 및 localStorage 동기화만 담당한다.
 * - 선택값은 `localStorage["theme"]`에 "light" | "dark"로 저장한다. 값이 없으면
 *   시스템 설정(prefers-color-scheme)을 따른다.
 * - 아이콘 표시는 React state가 아니라 `dark:` CSS 클래스로만 전환한다. 현재 테마를
 *   effect에서 DOM을 읽어 state로 동기화하면 렌더 직후 추가 렌더가 발생하고
 *   (react-hooks/set-state-in-effect), 서버 렌더링 시점엔 알 수 없는 값이라 깜빡임도
 *   생긴다 — 두 아이콘을 모두 렌더링하고 CSS로 하나만 보이게 하면 이 문제가 없다.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    root.classList.toggle("dark", next);
    window.localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="라이트/다크 모드 전환"
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-sm text-muted transition-colors hover:border-border-strong hover:bg-surface-subtle hover:text-foreground"
    >
      <span aria-hidden="true" className="dark:hidden">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
        </svg>
      </span>
      <span aria-hidden="true" className="hidden dark:inline">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5 8.5 8.5 0 1 0 20.5 14.1Z" />
        </svg>
      </span>
    </button>
  );
}
