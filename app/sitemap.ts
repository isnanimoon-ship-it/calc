import type { MetadataRoute } from "next";
import {
  categoryOrder,
  getPublishedCalculators,
  getPublishedCalculatorsGroupedByCategory,
} from "@/src/calculators/registry";
import { siteUrl } from "@/src/lib/site-config";

/**
 * 레지스트리(src/calculators/registry.ts)를 순회해 자동 생성한다.
 * sitemap.xml을 손으로 편집하지 않는다 (docs/ARCHITECTURE.md SEO 규칙 2번).
 * status가 "draft"인 계산기는 getPublishedCalculators()에서 이미 제외되므로
 * 여기서 별도로 필터링할 필요가 없다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const today = new Date().toISOString().slice(0, 10);

  const calculatorEntries: MetadataRoute.Sitemap = getPublishedCalculators().map(
    (calculator) => ({
      url: `${siteUrl}/calculators/${calculator.slug}`,
      lastModified: calculator.lastModified,
    }),
  );

  // 공개된 계산기가 1개 이상 있는 카테고리만 포함한다 — app/categories/[category]/page.tsx의
  // generateStaticParams()/404 규칙과 동일한 기준(빈 카테고리 페이지는 존재하지 않는다).
  const categoryGroups = getPublishedCalculatorsGroupedByCategory();
  const categoryEntries: MetadataRoute.Sitemap = categoryOrder
    .filter((category) => categoryGroups.some((group) => group.category === category))
    .map((category) => ({
      url: `${siteUrl}/categories/${category}`,
      lastModified: today,
    }));

  // 계산기 레지스트리에 없는 고정 정보 페이지 — 계산기가 아니므로 레지스트리 대상이
  // 아니지만, 사이트맵에는 함께 노출되어야 한다.
  const staticEntries: MetadataRoute.Sitemap = ["/about", "/contact", "/privacy", "/terms"].map(
    (path) => ({
      url: `${siteUrl}${path}`,
      lastModified: today,
    }),
  );

  return [
    {
      url: siteUrl,
      lastModified: today,
    },
    ...categoryEntries,
    ...calculatorEntries,
    ...staticEntries,
  ];
}
