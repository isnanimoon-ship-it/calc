/**
 * 계산기 페이지 공통 카드 wrapper.
 *
 * docs/ARCHITECTURE.md "SEO / 사이트맵" 페이지 구조(계산기 → 결과 → 사용 방법 → 공식 → 예제 →
 * FAQ)의 각 단계가 텍스트만 나열되지 않고 시각적 계층(카드 구분·아이콘·제목/설명 위계)을 갖추도록
 * 하는 공통 wrapper다(SPEC.md v2 "디자인: 카드/시각적 계층" 요구사항 대응).
 *
 * 이 파일은 Architect 산출물(구조/컴포넌트 껍데기)이다 — 실제 카피/콘텐츠는 담지 않는다.
 * UsageGuide, IntroSection, FaqAccordion이 공통으로 이 컴포넌트를 감싸 쓴다(중복 카드 스타일
 * 방지). 계산기별 결과 화면의 기존 섹션(핵심 결과/계산 상세 등, severance-pay/ui.tsx)이 쓰는
 * 카드 스타일(`rounded-lg border border-black/10 p-5 dark:border-white/15`)과 시각적으로
 * 일관되게 맞췄다.
 */

import type { ReactNode } from "react";

export interface SectionCardProps {
  /** 카드 제목. */
  title: string;
  /** 제목 아래 붙는 한 줄 부가 설명(선택). */
  description?: string;
  /**
   * 카드 좌측에 표시할 아이콘/단계 뱃지(선택). 이모지 문자열이나 임의의 ReactNode를 받는다 —
   * 계산기마다 다른 아이콘 체계를 강제하지 않기 위해 특정 아이콘 라이브러리에 묶지 않았다.
   */
  icon?: ReactNode;
  /** 카드 본문. */
  children: ReactNode;
  /**
   * heading 태그 레벨. 페이지 전체의 heading 위계(h1 다음 h2, 그 하위는 h3 등)를 지키기 위해
   * 호출부가 명시적으로 지정한다. 기본값 "h2".
   */
  headingLevel?: "h2" | "h3";
  /** 카드 wrapper에 추가할 className(레이아웃 조정용, 선택). */
  className?: string;
}

export function SectionCard({
  title,
  description,
  icon,
  children,
  headingLevel = "h2",
  className,
}: SectionCardProps) {
  const Heading = headingLevel;

  return (
    <section
      className={`rounded-2xl border border-border bg-surface p-6 ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-base text-primary"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Heading className="text-base font-semibold tracking-tight">{title}</Heading>
          {description && (
            <p className="mt-1 text-sm leading-6 text-muted">
              {description}
            </p>
          )}
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </section>
  );
}
