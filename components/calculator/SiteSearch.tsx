"use client";

/**
 * 헤더 검색 — 계산기가 많아질수록 카테고리를 뒤지는 것보다 이름으로 바로 찾는 게
 * 빠르다는 판단(2026-09-13)으로 추가했다. 별도 검색 서버 없이, 빌드 시점에 이미 확정된
 * `calculatorRegistry`(레지스트리, 전부 정적 데이터) 안에서만 필터링하므로 백엔드가
 * 필요 없다 — 데이터는 서버 컴포넌트(app/layout.tsx)가 `getPublishedCalculators()`로
 * 만들어 이 컴포넌트에 props로 내려준다(이 파일 자체는 registry.ts를 import하지 않는다 —
 * "use client" 경계 너머로 함수가 아니라 순수 데이터만 건너가게 하기 위함).
 *
 * 네이티브 `<dialog>`를 쓴다 — `showModal()`이 포커스 트랩·바깥 클릭 시 배경 스크롤 방지·
 * Esc로 닫기를 브라우저가 기본 제공해 별도 접근성 로직을 구현할 필요가 없다.
 */
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

export interface SearchableCalculator {
  slug: string;
  title: string;
  description: string;
  categoryLabel: string;
}

const MAX_RESULTS = 8;

export function SiteSearch({ calculators }: { calculators: SearchableCalculator[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  function open() {
    dialogRef.current?.showModal();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function close() {
    dialogRef.current?.close();
    setQuery("");
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return calculators
      .filter(
        (calculator) =>
          calculator.title.toLowerCase().includes(q) ||
          calculator.description.toLowerCase().includes(q) ||
          calculator.categoryLabel.toLowerCase().includes(q),
      )
      .slice(0, MAX_RESULTS);
  }, [query, calculators]);

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="계산기 검색"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-colors hover:border-border-strong hover:bg-surface-subtle hover:text-foreground"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m20 20-4.3-4.3" strokeLinecap="round" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setQuery("")}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        aria-label="계산기 검색"
        className="w-[min(92vw,32rem)] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-[0_24px_70px_-30px_rgba(16,24,40,.55)] backdrop:bg-black/50 open:m-auto"
      >
        <div className="p-4">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2.5 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-muted">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m20 20-4.3-4.3" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="계산기 이름으로 검색 (예: 퇴직금, BMI, 대출)"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
            <button
              type="button"
              onClick={close}
              aria-label="검색 닫기"
              className="shrink-0 text-muted hover:text-foreground"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <ul className="mt-3 max-h-80 space-y-0.5 overflow-y-auto">
            {query.trim() === "" ? (
              <li className="px-2 py-8 text-center text-sm text-muted">
                계산기 이름을 입력해보세요.
              </li>
            ) : results.length === 0 ? (
              <li className="px-2 py-8 text-center text-sm text-muted">
                &ldquo;{query}&rdquo;와 일치하는 계산기가 없습니다.
              </li>
            ) : (
              results.map((calculator) => (
                <li key={calculator.slug}>
                  <Link
                    href={`/calculators/${calculator.slug}`}
                    onClick={close}
                    className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-subtle"
                  >
                    <p className="text-sm font-semibold">{calculator.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                      {calculator.description}
                    </p>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </dialog>
    </>
  );
}
