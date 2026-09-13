/**
 * "사용 방법" 섹션 — docs/ARCHITECTURE.md "SEO / 사이트맵" 페이지 구조(계산기 → 결과 →
 * 사용 방법 → 공식 → 예제 → FAQ)의 "사용 방법" 단계, SPEC.md v2 "사용 안내" 섹션 요구사항에
 * 대응하는 공용 컴포넌트 껍데기.
 *
 * 계산기를 처음 보는 사용자에게 "어떤 값을 어떻게 입력하면 되는지"를 짧은 단계 목록으로
 * 보여준다. 실제 단계 문구(예: "입사일과 퇴사일을 입력하면...")는 이 컴포넌트가 정의하지 않고
 * `steps` prop으로 계산기별로 주입한다 — 콘텐츠 연결은 Builder 몫.
 */

import type { ReactNode } from "react";
import { SectionCard } from "./SectionCard";

export interface UsageGuideStep {
  /** 단계 번호(1부터). 생략하면 배열 인덱스+1을 자동으로 사용한다. */
  step?: number;
  /** 단계 제목(짧게, 예: "입사일·퇴사일 입력"). */
  title: string;
  /** 단계 설명. */
  description: string;
  /** 단계별 아이콘/이모지(선택). */
  icon?: ReactNode;
}

export interface UsageGuideProps {
  /** 섹션 제목. 기본값 "사용 방법". */
  title?: string;
  /** 섹션 제목 아래 부가 설명(선택). */
  description?: string;
  /** 단계 목록. 순서대로 번호가 매겨진 목록으로 렌더링한다. */
  steps: UsageGuideStep[];
}

export function UsageGuide({
  title = "사용 방법",
  description,
  steps,
}: UsageGuideProps) {
  return (
    <SectionCard title={title} description={description}>
      <ol className="space-y-4">
        {steps.map((item, index) => (
          <li key={item.title} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black text-xs font-medium text-white dark:bg-white dark:text-black"
            >
              {item.icon ?? item.step ?? index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                {item.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
