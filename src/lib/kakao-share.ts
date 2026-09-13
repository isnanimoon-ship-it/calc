/**
 * 카카오톡 공유 어댑터 — docs/SHARING.md "카카오 운영 설정" 절차를 그대로 구현한다.
 *
 * SDK는 항상 로드해두지 않고, 사용자가 실제로 "카카오톡" 버튼을 눌렀을 때만 지연 로드한다
 * (`components/calculator/ShareActions.tsx`가 `onKakaoShare`를 호출하는 시점) — 이 기능을
 * 쓰지 않는 대다수 방문자에게 약 85KB의 SDK를 미리 내려받게 하지 않기 위해서다.
 *
 * SDK 버전(2.8.3)과 integrity 해시는 CDN에서 받은 파일을 직접 sha384로 해시해 만들었다
 * (2026-09-13 확인) — 카카오 공식 문서 페이지의 표시값을 그대로 베끼지 않고 실제 파일
 * 바이트로 재계산했다. SDK 버전을 올릴 때는 이 해시도 반드시 같은 방법으로 다시 계산해야
 * 한다(맞지 않으면 브라우저가 스크립트 실행 자체를 조용히 차단한다).
 */
import type { SharePayload } from "./share";

const KAKAO_SDK_VERSION = "2.8.3";
const KAKAO_SDK_URL = `https://t1.kakaocdn.net/kakao_js_sdk/${KAKAO_SDK_VERSION}/kakao.min.js`;
const KAKAO_SDK_INTEGRITY =
  "sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy";

interface KakaoGlobal {
  init: (jsKey: string) => void;
  isInitialized: () => boolean;
  Share: {
    sendDefault: (options: {
      objectType: "feed";
      content: {
        title: string;
        description: string;
        imageUrl: string;
        link: { mobileWebUrl: string; webUrl: string };
      };
      buttons: Array<{ title: string; link: { mobileWebUrl: string; webUrl: string } }>;
    }) => void;
  };
}

declare global {
  interface Window {
    Kakao?: KakaoGlobal;
  }
}

let sdkLoadPromise: Promise<void> | null = null;

function loadKakaoSdk(): Promise<void> {
  if (window.Kakao) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = KAKAO_SDK_URL;
    script.integrity = KAKAO_SDK_INTEGRITY;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => {
      sdkLoadPromise = null; // 실패 시 다음 클릭에서 다시 시도할 수 있게 초기화
      reject(new Error("카카오 SDK를 불러오지 못했습니다."));
    };
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

async function ensureKakaoInitialized(jsKey: string): Promise<KakaoGlobal> {
  await loadKakaoSdk();
  if (!window.Kakao) throw new Error("카카오 SDK 로드 후에도 window.Kakao가 없습니다.");
  if (!window.Kakao.isInitialized()) window.Kakao.init(jsKey);
  return window.Kakao;
}

/**
 * `ShareActions`의 `onKakaoShare` prop에 그대로 전달하는 어댑터.
 *
 * `NEXT_PUBLIC_KAKAO_JS_KEY`가 설정되지 않으면 이 값 자체가 `undefined`다 — 계산기
 * 코드에서 조건 분기를 만들 필요 없이 `onKakaoShare={kakaoShareAdapter}`만 넘기면,
 * ShareActions가 undefined를 받아 기존과 동일하게 "설정 필요" 툴팁과 함께 버튼을
 * 비활성화한다(docs/SHARING.md). 값이 설정되면 그대로 실제 공유 함수가 된다.
 */
export const kakaoShareAdapter = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
  ? async function kakaoShareAdapter(payload: SharePayload): Promise<void> {
      const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (!jsKey) return;
      const kakao = await ensureKakaoInitialized(jsKey);
      kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: payload.title,
          description: payload.text,
          imageUrl: `${window.location.origin}/apple-icon`,
          link: { mobileWebUrl: payload.url, webUrl: payload.url },
        },
        buttons: [
          {
            title: "결과 보기",
            link: { mobileWebUrl: payload.url, webUrl: payload.url },
          },
        ],
      });
    }
  : undefined;
