"use client";

/**
 * FAQ 접고펴기 섹션 — SPEC.md v2 "소개 콘텐츠 + FAQ 섹션" 요구사항, docs/ARCHITECTURE.md
 * "SEO / 사이트맵" 페이지 구조의 "FAQ" 단계에 대응하는 공용 컴포넌트 껍데기.
 *
 * 실제 질문/답변 내용(tasks/severance-pay/FORMULA.md "FAQ 콘텐츠" 등)은 이 컴포넌트가 정의하지
 * 않고 `items` prop으로 계산기별로 주입한다.
 *
 * 접근성(docs/DESIGN_SYSTEM.md "접근성"): 각 질문은 aria-expanded가 있는 버튼이고, 답변
 * 패널은 aria-labelledby로 질문 버튼과 연결된다 — 키보드만으로 조작 가능, 색상만으로 상태를
 * 표현하지 않는다(펼침 아이콘 회전 + aria-expanded 병행).
 *
 * JSON-LD FAQPage 스키마 삽입(docs/ARCHITECTURE.md SEO 규칙 4번)은 이 컴포넌트의 책임이 아니다
 * — 페이지 레벨에서 `items`와 동일한 질문/답변 데이터를 별도로 JSON-LD로 직렬화해야 하며, 이는
 * Builder/SEO 작업 단계에서 처리한다.
 */

import { useId, useState } from "react";
import { SectionCard } from "./SectionCard";

export interface FaqItem {
  /** 질문. */
  question: string;
  /** 답변. 여러 문단을 허용하기 위해 배열로 받는다(단일 문단이면 길이 1 배열). */
  answer: string[];
}

export interface FaqAccordionProps {
  /** 섹션 제목. 기본값 "자주 묻는 질문". */
  title?: string;
  /** 질문/답변 목록. */
  items: FaqItem[];
  /**
   * 처음부터 펼쳐 둘 항목의 인덱스(선택). 지정하지 않으면 모두 접힌 상태로 시작한다.
   * SEO 관점에서 크롤러가 접힌 콘텐츠도 읽을 수 있는지는 실제 렌더링 방식(DOM에 항상 존재하되
   * CSS로만 숨기는지 여부)에 따라 달라지므로, 그 결정은 Builder가 콘텐츠를 연결할 때 함께
   * 검토한다.
   */
  defaultOpenIndex?: number;
}

export function FaqAccordion({
  title = "자주 묻는 질문",
  items,
  defaultOpenIndex,
}: FaqAccordionProps) {
  const idBase = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(
    defaultOpenIndex ?? null,
  );

  return (
    <SectionCard title={title}>
      <div className="divide-y divide-border">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          const buttonId = `${idBase}-faq-button-${index}`;
          const panelId = `${idBase}-faq-panel-${index}`;

          return (
            <div key={item.question} className="py-5 first:pt-2 last:pb-1">
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 text-left text-[15px] font-semibold leading-6"
              >
                <span>{item.question}</span>
                <span
                  aria-hidden="true"
                  className={`shrink-0 text-muted transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </button>
              {isOpen && (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="mt-4 space-y-3 pr-7 text-sm leading-7 text-muted"
                >
                  {item.answer.map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex}>{paragraph}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
