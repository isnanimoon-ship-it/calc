/**
 * 홈/카테고리 목록에 쓰이는 계산기 카드 — 아이콘 + 제목 + 설명, 클릭 시 상세 페이지로 이동.
 *
 * 참고 이미지(다크 테마 개발자 도구 모음 사이트)의 카드 밀도를 목표로 하되, 실제 다크
 * 테마 색상/그림자 등 시각적 마감은 Builder 몫이라 여기서는 기존 SectionCard와 동일한
 * 시각 언어(아이콘 뱃지 + rounded border 카드)만 최소한으로 유지했다.
 *
 * SectionCard(계산기 페이지 내부 섹션용, children에 임의 콘텐츠를 받는 wrapper)와 역할이
 * 겹치지 않는다 — 이 컴포넌트는 항상 CalculatorMeta 하나를 상세 페이지로 링크하는
 * "카드 = 링크" 전용이라 별도로 분리했다. 카드 스타일을 SectionCard와 다시 합치고 싶어지면
 * 그때 공통 하위 컴포넌트로 추출한다(지금은 둘 다 단순해서 추출 이득이 크지 않음).
 */

import Link from "next/link";
import type { CalculatorMeta } from "@/src/calculators/registry";

export interface CalculatorCardProps {
  calculator: CalculatorMeta;
}

function CalculatorIcon({ name }: { name: CalculatorMeta["icon"] }) {
  if (name === "coins") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
        <ellipse cx="9" cy="7" rx="5" ry="2.5" />
        <path d="M4 7v4c0 1.4 2.2 2.5 5 2.5.7 0 1.4-.1 2-.2M4 11v4c0 1.4 2.2 2.5 5 2.5.5 0 1 0 1.5-.1" />
        <ellipse cx="16" cy="14" rx="4" ry="2" />
        <path d="M12 14v4c0 1.1 1.8 2 4 2s4-.9 4-2v-4" />
      </svg>
    );
  }
  // "calculator" (unemployment-benefit이 처음 쓴다, 2026-09-02) — 계산기 몸체 + 화면 + 버튼
  // 그리드로, 이전까지 "coins"가 아닌 모든 키의 fallback으로 쓰이던 아래 default SVG(문서/그리드
  // 아이콘)와 시각적으로 구분되도록 명시적 분기로 뺐다(docs/DESIGN_SYSTEM.md "아이콘" 규칙 —
  // 새 키는 대응하는 SVG를 추가한다).
  if (name === "calculator") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
        <rect x="5" y="3" width="14" height="18" rx="2.5" />
        <rect x="7.5" y="5.5" width="9" height="3.5" rx="0.8" />
        <path d="M7.7 12.3h.01M11.5 12.3h.01M15.3 12.3h.01M7.7 15.6h.01M11.5 15.6h.01M15.3 15.6h.01M7.7 18.9h.01M11.5 18.9h.01M15.3 18.9h.01" strokeLinecap="round" strokeWidth="2.1" />
      </svg>
    );
  }
  // "calendar" (weekly-holiday-allowance이 처음 쓴다, 2026-09-04) — 달력 그리드 + 상단 고리,
  // 한 칸을 강조해 "유급 주휴일" 개념을 나타낸다. coins/calculator와 시각적으로 구분된다.
  if (name === "calendar") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" strokeLinecap="round" />
        <rect x="6.5" y="12" width="4" height="3.5" rx="0.7" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  // "chart"(housing-subscription-score가 처음 쓴다, 2026-09-06) — 오름차순 막대그래프,
  // "가점 점수"라는 결과 성격과 잘 맞고 coins/calculator/calendar와 시각적으로 구분된다.
  if (name === "chart") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
        <path d="M4 20V4" strokeLinecap="round" />
        <rect x="6.5" y="13" width="3.5" height="7" rx="0.8" fill="currentColor" stroke="none" />
        <rect x="12" y="9" width="3.5" height="11" rx="0.8" fill="currentColor" stroke="none" />
        <rect x="17.5" y="5.5" width="3.5" height="14.5" rx="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  // "trend"(average-cost-calculator가 처음 쓴다, 2026-09-12) — 등락 지그재그 추세선 +
  // 끝점 화살표. "평단가 변동(하락/상승)"이라는 결과 성격과 잘 맞고 coins/calculator/
  // calendar/chart와 시각적으로 구분된다(tasks/average-cost-calculator/ARCHITECTURE.md "8.").
  if (name === "trend") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
        <path d="M4 16.5 9.5 11l3.5 3.5L20 7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.5 7h5.5v5.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" />
    </svg>
  );
}

export function CalculatorCard({ calculator }: CalculatorCardProps) {
  return (
    <Link
      href={`/calculators/${calculator.slug}`}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-[0_14px_40px_-32px_rgba(16,24,40,.45)] transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_18px_45px_-28px_rgba(49,87,213,.35)]"
    >
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-lg text-primary"
      >
        <CalculatorIcon name={calculator.icon} />
      </span>
      <div className="min-w-0 pt-0.5">
        <h3 className="font-semibold tracking-tight">{calculator.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
          {calculator.description}
        </p>
      </div>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="ml-auto h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  );
}
