# QA: 영업일 계산기

검증일: 2026-09-04  
최종 판정: **PASS**

## 자동 검증

- 계산기 로직·검증·UI·데이터 무결성 테스트: PASS
- 전체 Vitest 회귀 테스트: PASS (23개 파일, 274개 테스트)
- ESLint: PASS
- TypeScript/Next.js production build: PASS

## 기능 및 경계

- 기간 계산과 N영업일 이전·이후: PASS
- 양끝 날짜 포함 4개 조합: PASS
- 0영업일과 기준일 포함: PASS
- 주말·공휴일·대체공휴일·선거일·노동절 토글: PASS
- 사용자 지정 휴무일과 중복 제외: PASS
- 설·추석 장기 연휴와 대체공휴일: PASS
- 지원 범위 이탈 차단: PASS
- 공휴일 상세 사유와 합계 일치: PASS

## 접근성·반응형

- 모드·방향 radio, 제외 설정 checkbox: PASS
- 날짜·숫자 입력 label과 오류: PASS
- 결과 `aria-live`: PASS
- 모바일 상세 내역 목록: PASS
- 다크모드 결과 대비: PASS

Critical 0, High 0으로 QA PASS.
