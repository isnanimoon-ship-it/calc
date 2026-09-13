/**
 * 소개 콘텐츠 섹션 — SPEC.md v2 "소개 콘텐츠 + FAQ 섹션" 요구사항, docs/ARCHITECTURE.md
 * "SEO / 사이트맵" 페이지 구조의 "예제/FAQ" 단계 앞에 오는 소개("이 계산기란 무엇인가요?") 자리에
 * 대응하는 공용 컴포넌트 껍데기.
 *
 * 실제 소개 문구(tasks/severance-pay/FORMULA.md "소개 문구" 등)는 이 컴포넌트가 정의하지 않고
 * `paragraphs`/`highlights` prop으로 계산기별로 주입한다.
 */

import { SectionCard } from "./SectionCard";

export interface IntroSectionProps {
  /** 섹션 제목(예: "퇴직금 계산기란 무엇인가요?"). */
  title: string;
  /** 소개 문단들. 순서대로 각각 하나의 <p>로 렌더링한다. */
  paragraphs: string[];
  /**
   * 짧은 강조 포인트 목록(선택, 예: "이런 분께 유용해요" 요약). 문단 아래 불릿 목록으로
   * 렌더링한다.
   */
  highlights?: string[];
}

export function IntroSection({
  title,
  paragraphs,
  highlights,
}: IntroSectionProps) {
  return (
    <SectionCard title={title}>
      <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {highlights && highlights.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          {highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
