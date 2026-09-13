/**
 * 트위터(X) 카드 미리보기 이미지 — `opengraph-image.tsx`와 완전히 동일한 이미지를
 * 재사용한다(디자인을 두 곳에 중복 유지하지 않기 위해 재export). Next.js는 파일
 * 컨벤션으로 두 메타 태그(og:image, twitter:image)를 각각 채우므로, 트위터 전용으로
 * 다른 이미지를 쓰고 싶어지면 이 파일 내용만 따로 바꾸면 된다.
 */
export { default, alt, size, contentType } from "./opengraph-image";
