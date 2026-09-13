export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

interface ShareStateEnvelope {
  v: 1;
  d: unknown;
}

const MAX_ENCODED_STATE_LENGTH = 12_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** JSON 상태를 URL query에 안전한 Base64URL 문자열로 바꾼다. 암호화 기능은 제공하지 않는다. */
export function encodeShareState(data: unknown): string {
  const envelope: ShareStateEnvelope = { v: 1, d: data };
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(envelope)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/** 손상되었거나 지원하지 않는 상태는 화면 오류 대신 null로 반환한다. */
export function decodeShareState(encoded: string): unknown | null {
  if (!encoded || encoded.length > MAX_ENCODED_STATE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<ShareStateEnvelope>;
    if (!parsed || typeof parsed !== "object" || parsed.v !== 1 || !("d" in parsed)) return null;
    return parsed.d;
  } catch {
    return null;
  }
}

/** 기존 query/hash를 제거하고 단일 `s` 파라미터를 가진 결과 공유 URL을 만든다. */
export function buildStateShareUrl(baseUrl: string, data: unknown): string {
  const result = new URL(baseUrl);
  result.search = "";
  result.hash = "";
  result.searchParams.set("s", encodeShareState(data));
  return result.toString();
}

export function buildXIntentUrl(payload: SharePayload): string {
  const query = new URLSearchParams({ text: payload.text, url: payload.url });
  return `https://x.com/intent/tweet?${query.toString()}`;
}

export function getShareUrl(explicitUrl?: string): string {
  if (explicitUrl) return explicitUrl;
  if (typeof window !== "undefined") return window.location.href;
  return "";
}
