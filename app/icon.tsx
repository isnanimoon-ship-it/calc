import { ImageResponse } from "next/og";

/**
 * 브라우저 탭 파비콘 — 헤더 로고(app/layout.tsx)와 동일한 계산기 모양 SVG를 재사용해
 * 코드로 생성한다. 기존 `app/favicon.ico`는 2026-09-02 create-next-app 스캐폴딩이 만든
 * 기본 Next.js 아이콘 그대로 방치되어 있었다(2026-09-13 실제 배포 확인 결과) — 이 파일이
 * 그 자리를 대신한다. 정적 이미지 파일을 별도로 만들 필요 없이, Next.js가 빌드 시 이 함수를
 * 실행해 PNG를 생성하고 `<link rel="icon">`도 자동으로 삽입한다.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3157d5",
          borderRadius: 7,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="2" width="16" height="20" rx="3" stroke="#ffffff" strokeWidth="1.8" />
          <rect x="6.5" y="4.5" width="11" height="4" rx="1" fill="#ffffff" />
          <circle cx="7.5" cy="12.5" r="1.3" fill="#ffffff" />
          <circle cx="12" cy="12.5" r="1.3" fill="#ffffff" />
          <circle cx="16.5" cy="12.5" r="1.3" fill="#ffffff" />
          <circle cx="7.5" cy="17" r="1.3" fill="#ffffff" />
          <circle cx="12" cy="17" r="1.3" fill="#ffffff" />
          <circle cx="16.5" cy="17" r="1.3" fill="#ffffff" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
