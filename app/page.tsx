import { CalculatorCard } from "@/components/calculator/CalculatorCard";
import { CategorySection } from "@/components/calculator/CategorySection";
import {
  getPublishedCalculatorsGroupedByCategory,
  getRecentlyAddedCalculators,
} from "@/src/calculators/registry";

const RECENT_CALCULATORS_LIMIT = 6;

/**
 * 홈페이지 계산기 목록 — 레지스트리 기반으로 동적 생성한다 (docs/ARCHITECTURE.md SEO 규칙 5번).
 * status가 "draft"인 계산기는 getPublishedCalculatorsGroupedByCategory()에서 이미
 * 제외되므로 노출되지 않고, 계산기가 하나도 없는 카테고리는 섹션 자체가 생성되지 않는다
 * (docs/ARCHITECTURE.md "공통 UI 컴포넌트" 참고 — 카테고리가 늘어나면 자동으로 채워지는 구조).
 *
 * 히어로의 특징 배지(heroFeatures)는 docs/ARCHITECTURE.md "개인정보/데이터 처리" 원칙
 * 그대로다 — 서버 미전송, 계산 근거 공개, 무료라는 실제 특징만 나열하며 카드가 아직
 * 1개뿐인 상태에서도 상단이 휑해 보이지 않도록 밀도를 채운다.
 */
export default function Home() {
  const groups = getPublishedCalculatorsGroupedByCategory();
  const recentCalculators = getRecentlyAddedCalculators(RECENT_CALCULATORS_LIMIT);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-16 sm:px-8 sm:py-24">
      <section className="max-w-3xl">
        <p className="text-sm font-semibold text-primary">근거 있는 계산</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.045em] sm:text-6xl">
          필요한 계산을,<br />근거와 함께.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
          복잡한 법률과 금융 공식을 쉽게 계산하고, 결과가 나온 과정까지 투명하게 확인하세요.
        </p>
        <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <span>브라우저에서만 계산</span>
          <span aria-hidden="true" className="text-border-strong">•</span>
          <span>가입 없이 무료</span>
          <span aria-hidden="true" className="text-border-strong">•</span>
          <span>공식과 근거 공개</span>
        </div>
      </section>

      {recentCalculators.length > 0 && (
        <section aria-labelledby="recent-calculators" className="mt-12">
          <h2 id="recent-calculators" className="text-sm font-semibold text-muted">
            최근 추가된 계산기
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentCalculators.map((calculator) => (
              <li key={calculator.slug}>
                <CalculatorCard calculator={calculator} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-black/15 p-6 text-sm text-zinc-500 dark:border-white/20 dark:text-zinc-400">
          아직 공개된 계산기가 없습니다. 준비 중입니다.
        </p>
      ) : (
        groups.map((group) => <CategorySection key={group.category} group={group} />)
      )}
    </div>
  );
}
