import type { MetadataRoute } from "next";
import { siteUrl } from "@/src/lib/site-config";

/**
 * app/sitemap.ts와 동일한 siteUrl을 공유한다 (docs/ARCHITECTURE.md SEO 규칙 2번).
 * draft 계산기 페이지는 sitemap에 자체적으로 오르지 않으며, 별도 disallow 규칙은
 * 두지 않는다 — draft 라우트도 app/calculators/[slug]/page.tsx에서 실제로 렌더링되지만
 * (QA가 URL을 직접 열어 확인할 수 있어야 하므로), sitemap/홈/카테고리 목록 어디에도
 * 링크되지 않아 크롤러가 정상적으로 발견할 경로가 없다. status가 "published"로 바뀌기
 * 전까지는 검색엔진에 자연 노출되지 않는다는 전제이며, URL을 직접 아는 경우의 접근까지
 * robots 규칙으로 막지는 않는다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
