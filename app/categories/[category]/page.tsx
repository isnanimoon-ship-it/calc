import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalculatorCard } from "@/components/calculator/CalculatorCard";
import {
  categoryLabels,
  categoryOrder,
  getPublishedCalculatorsByCategory,
  type CalculatorCategory,
} from "@/src/calculators/registry";
import { siteUrl } from "@/src/lib/site-config";

type CategoryPageProps = {
  params: Promise<{ category: string }>;
};

/**
 * 문자열 slug가 실제 CalculatorCategory 키인지 확인한다. `categoryOrder`(registry.ts SSOT)를
 * 그대로 참조해, 카테고리가 늘어나거나 이름이 바뀌어도 이 파일을 고칠 필요가 없게 한다.
 */
function isValidCategory(value: string): value is CalculatorCategory {
  return (categoryOrder as readonly string[]).includes(value);
}

/**
 * 정적 생성 대상 — 공개된 계산기가 1개 이상 있는 카테고리만 생성한다. 홈페이지
 * (getPublishedCalculatorsGroupedByCategory)가 "빈 카테고리 섹션은 렌더링하지 않는다"는
 * 규칙과 동일한 원칙을 여기서도 지킨다 — 계산기가 아직 없는 카테고리로 직접 URL을
 * 입력해 들어와도 404 처리된다(아래 default export).
 */
export function generateStaticParams() {
  return categoryOrder
    .filter((category) => getPublishedCalculatorsByCategory(category).length > 0)
    .map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  if (!isValidCategory(category) || getPublishedCalculatorsByCategory(category).length === 0) {
    return {};
  }

  const label = categoryLabels[category];
  return {
    title: `${label} 계산기`,
    description: `${label} 관련 계산기를 한 곳에서 모아봤습니다.`,
    alternates: {
      // 쿼리스트링 등 화면 상태와 무관하게 canonical을 고정한다 (docs/ARCHITECTURE.md SEO 규칙 3번).
      canonical: `/categories/${category}`,
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;

  if (!isValidCategory(category)) {
    notFound();
  }

  const calculators = getPublishedCalculatorsByCategory(category);

  // 공개된 계산기가 아직 하나도 없는 카테고리는 콘텐츠 없는 빈 페이지 대신 404 처리한다
  // (홈페이지가 빈 카테고리 섹션 자체를 렌더링하지 않는 것과 같은 원칙).
  if (calculators.length === 0) {
    notFound();
  }

  const label = categoryLabels[category];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${label} 계산기 모음`,
    url: `${siteUrl}/categories/${category}`,
  };

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-16 sm:px-8 sm:py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-primary"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <path d="m15 18-6-6 6-6" />
        </svg>
        전체 계산기
      </Link>
      <header className="mt-5 max-w-3xl">
        <p className="text-sm font-semibold text-primary">{label}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
          {label} 계산기
        </h1>
        <p className="mt-3 text-base leading-7 text-muted">
          {label} 관련 계산기 {calculators.length}개를 모아봤습니다.
        </p>
      </header>
      <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {calculators.map((calculator) => (
          <li key={calculator.slug}>
            <CalculatorCard calculator={calculator} />
          </li>
        ))}
      </ul>
    </div>
  );
}
