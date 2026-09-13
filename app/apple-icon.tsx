import { ImageResponse } from "next/og";

/**
 * iOS/Android 홈 화면에 추가할 때 쓰이는 아이콘 — app/icon.tsx(브라우저 탭 파비콘)와
 * 같은 계산기 모양 SVG를 더 큰 캔버스(180x180, Apple 권장 규격)에 그린다.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        }}
      >
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="2" width="16" height="20" rx="3" stroke="#ffffff" strokeWidth="1.6" />
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
