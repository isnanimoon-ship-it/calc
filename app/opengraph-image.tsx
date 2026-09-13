import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * 링크 공유 시(카카오톡·트위터·페이스북 등) 뜨는 미리보기 이미지 — 사이트 전역 기본값.
 * 계산기별 페이지는 아직 이 기본 이미지를 그대로 물려받는다(계산기마다 다른 이미지가
 * 필요해지면 `app/calculators/[slug]/opengraph-image.tsx`를 별도로 추가하면 된다).
 *
 * 한글 텍스트를 그리려면 Satori(next/og의 렌더 엔진)에 폰트 파일을 직접 넘겨야 한다 —
 * 시스템 폰트를 읽지 못해 폰트를 안 넘기면 한글이 빈 사각형으로 렌더링된다. 매 요청마다
 * 외부 CDN에서 폰트를 내려받으면 그 CDN이 느리거나 죽었을 때 이미지 생성 자체가
 * 실패할 수 있어(카카오톡 등 공유 크롤러가 이 URL을 직접 호출한다), 이 사이트가 이미
 * 쓰고 있는 Pretendard 폰트 파일(docs/DESIGN_SYSTEM.md 폰트 폴백 체인)을 저장소에 함께
 * 두고 로컬에서 읽는다(`src/assets/fonts/`, jsdelivr `pretendard@1.3.9` npm 패키지의
 * 정적 OTF를 그대로 받아왔다).
 */
export const alt = "셈터 — 근거 있는 계산";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [bold, medium] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/Pretendard-Bold.otf")),
    readFile(join(process.cwd(), "src/assets/fonts/Pretendard-Medium.otf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #3157d5 0%, #1c2f7a 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "rgba(255,255,255,0.18)",
            }}
          >
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
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
          <span style={{ fontFamily: "Pretendard", fontWeight: 700, fontSize: 64, color: "#ffffff" }}>
            셈터
          </span>
        </div>
        <div
          style={{
            marginTop: 52,
            fontFamily: "Pretendard",
            fontWeight: 700,
            fontSize: 46,
            lineHeight: 1.35,
            color: "#ffffff",
          }}
        >
          필요한 계산을, 근거와 함께.
        </div>
        <div
          style={{
            marginTop: 30,
            fontFamily: "Pretendard",
            fontWeight: 500,
            fontSize: 28,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          브라우저에서만 계산 · 가입 없이 무료 · 공식과 근거 공개
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Pretendard", data: bold, weight: 700, style: "normal" },
        { name: "Pretendard", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
