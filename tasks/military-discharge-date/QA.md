# QA: 전역일 계산기

검증일: 2026-09-04  
최종 판정: **PASS**

## 자동 검증

- 전역일 계산기 로직·검증·UI 테스트: PASS
- 전체 Vitest 회귀 테스트: PASS (19개 파일, 228개 테스트)
- ESLint: PASS
- TypeScript/Next.js production build: PASS

## 기능 검증

| 항목 | 결과 |
|---|---|
| 현역 4개 군 기간 | PASS |
| 상근·사회복무 | PASS |
| 산업·예술체육·전문연구·기타 36개월 유형 | PASS |
| 종료일 `시작 + 개월 - 1일` | PASS |
| 남은 달력 기간과 D-day | PASS |
| 입영 전·복무 중·종료·완료 상태 | PASS |
| 진행률 0~100 제한 | PASS |
| 공통 및 현역 계급 타임라인 | PASS |
| 비현역 계급 미표시 | PASS |
| 계산 과정·정책 고지·FAQ | PASS |

## 경계 검증

- 윤년 2월 29일, 31일 월말, 연도 경계: PASS
- 잘못된 날짜와 2021년 이전 정책 범위: PASS
- 기준일 변경 시 기존 결과 제거: PASS
- 동일 D-day가 요약·타임라인·계산 근거에 일관되게 표시됨: PASS

## 접근성·반응형

- fieldset/legend와 실제 radio 사용: PASS
- 키보드 포커스 표시: PASS
- 날짜 label·도움말·오류 연결: PASS
- `aria-live`, progressbar 이름·현재값: PASS
- 타임라인 의미 목록: PASS
- 모바일 고정 폭 및 강제 페이지 가로 스크롤 없음: PASS

Critical 0, High 0으로 QA PASS.
