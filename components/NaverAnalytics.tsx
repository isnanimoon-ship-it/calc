"use client";

/**
 * 네이버 애널리틱스(웹로그 분석). `app/layout.tsx`(Server Component)에서 분리한 이유는
 * `next/script`의 `onLoad` 콜백이 Server Component에서 지원되지 않기 때문이다(Next.js
 * 공식 제약 — 함수는 Server→Client로 직렬화할 수 없다).
 *
 * `onLoad`를 반드시 써야 하는 이유(2026-09-13 실사용자 리포트로 발견한 버그): 처음에는
 * `wcslog.js` 로드 스크립트와 `wcs_do()` 호출 스크립트를 별개의 `<Script>` 두 개로
 * 나란히 뒀는데(네이버가 제공한 원본 스니펫 그대로), 실제 배포 사이트를 헤드리스
 * 브라우저로 실행 순서까지 추적해보니 `wcs_do()` 호출 스크립트가 `wcslog.js`의 네트워크
 * 로딩이 끝나기 **전에** 먼저 실행되어 `if(window.wcs)` 조건이 항상 거짓이었고,
 * `wcs_do()`가 단 한 번도 호출되지 않았다(그래서 네이버 실시간 분석에 방문이 잡히지
 * 않았다). 원본 스니펫의 순서 의존(두 `<script>` 태그가 동기적으로 순서대로 실행된다는
 * 가정)은 일반 HTML에서는 성립하지만, `next/script`의 `afterInteractive` 전략은 같은
 * 순서 보장을 하지 않는다 — `onLoad` 콜백으로 명시적으로 순서를 강제해야 한다.
 */
import Script from "next/script";

declare global {
  interface Window {
    wcs_add?: Record<string, string>;
    wcs?: unknown;
    wcs_do?: (...args: unknown[]) => void;
  }
}

const NAVER_ANALYTICS_WA_ID = "260cca4e6321980";

export function NaverAnalytics() {
  return (
    <Script
      src="//wcs.pstatic.net/wcslog.js"
      strategy="afterInteractive"
      onLoad={() => {
        if (!window.wcs_add) window.wcs_add = {};
        window.wcs_add["wa"] = NAVER_ANALYTICS_WA_ID;
        if (window.wcs) window.wcs_do?.();
      }}
    />
  );
}
