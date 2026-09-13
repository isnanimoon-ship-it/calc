/**
 * 사이트 전역 설정. 아직 실제 도메인이 확정되지 않아 임시 fallback을 둔다 —
 * 배포 시 `NEXT_PUBLIC_SITE_URL` 환경변수로 실제 도메인을 지정한다.
 * app/sitemap.ts, app/robots.ts, 계산기 페이지의 canonical URL 계산이 이 값을 공유한다.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com"
).replace(/\/$/, "");
