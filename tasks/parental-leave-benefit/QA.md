# QA: 육아휴직급여 계산기

검증일: 2026-09-04  
최종 판정: **PASS**

## 자동 검증

- 전체 Vitest 회귀 테스트: PASS (28개 파일, 305개 테스트)
- 육아휴직급여 정책·날짜·계산·검증·UI 테스트: PASS
- ESLint: PASS (오류·경고 0)
- TypeScript 및 Next.js production build: PASS

## 기능 및 경계

- 일반 급여 1~3·4~6·7개월 이후 경계: PASS
- 부모 함께 1~6개월 상한과 배우자 공통기간: PASS
- 부모 함께 생후 18개월 마지막 날/다음 날: PASS
- 한부모 첫 3개월과 4개월째 전환: PASS
- 선행 사용기간에 따른 급여월 이동: PASS
- 12→13개월 연장 확인 및 18개월 초과 차단: PASS
- 월 하한·상한과 고임금·저임금: PASS
- 29·30·31일, 윤년, 연도 경계: PASS
- 부분월 미지원 고지: PASS

## UX·접근성·반응형

- 제도 유형과 배우자 상태 radio: PASS
- 조건부 입력 및 연장요건 노출: PASS
- 입력 label, 오류 role=alert, 결과 aria-live: PASS
- 데스크톱 월별 표와 모바일 카드형 내역: PASS
- 라이트·다크 warning 토큰과 핵심 결과 대비: PASS
- 금액·정책 상태의 비색상 텍스트 표현: PASS

## 회귀

- 기존 계산기 테스트 전부 PASS
- 홈페이지·동적 계산기 라우트·sitemap production build PASS
- Console/TypeScript 오류 0

Critical 0 / High 0 / Mobile Critical 0으로 QA PASS.

