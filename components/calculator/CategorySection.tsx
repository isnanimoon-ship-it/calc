/**
 * 홈페이지의 카테고리별 섹션 — 한글 카테고리 라벨을 헤더로, 그 아래 CalculatorCard를
 * 그리드로 나열한다. 참고 이미지의 "데이터 / 텍스트 / 웹" 같은 섹션 구획에 대응한다.
 *
 * 빈 카테고리를 렌더링하지 않는 규칙은 이 컴포넌트가 아니라
 * `getPublishedCalculatorsGroupedByCategory()`(src/calculators/registry.ts)가 이미
 * 보장한다 — 그 함수가 계산기 0개인 카테고리를 결과에서 제외하므로 이 컴포넌트는 항상
 * 계산기 1개 이상인 그룹만 받는다는 전제로 단순하게 유지했다(그래도 방어적으로 한 번 더
 * 확인한다).
 *
 * 그리드 컬럼 수·간격 등 실제 레이아웃 CSS는 Builder가 다듬을 대상이라 최소 형태만 둔다.
 */

import { CalculatorCard } from "@/components/calculator/CalculatorCard";
import type { CalculatorCategoryGroup } from "@/src/calculators/registry";

export interface CategorySectionProps {
  group: CalculatorCategoryGroup;
}

export function CategorySection({ group }: CategorySectionProps) {
  if (group.calculators.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={`category-${group.category}`} className="mt-12">
      <h2 id={`category-${group.category}`} className="text-sm font-semibold text-muted">
        {group.label}
      </h2>
      <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {group.calculators.map((calculator) => (
          <li key={calculator.slug}>
            <CalculatorCard calculator={calculator} />
          </li>
        ))}
      </ul>
    </section>
  );
}
