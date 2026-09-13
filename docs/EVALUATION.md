# 평가 체계

## 역할 구조
| 역할 | 책임 | 코드 수정 |
|---|---|---|
| Product Owner | 목적/범위/Must-Should-Could 정의 | 불가 |
| Formula / Domain Analyst | 공식·변수·단위·계산순서·반올림정책·예외조건 정의, 법령/정책 출처 기록 | 불가 |
| Architect | 기술구조, 로직/UI 분리, 공통 컴포넌트, 폴더구조, 정밀도 전략 결정 | 가능(구조/스캐폴딩) |
| Builder | 승인된 SPEC·FORMULA 그대로 구현, 테스트 작성 | 가능 |
| Calculation Auditor | 계산 정확성 독립 검증 (아래 "검증 범위" 참고) | 불가 |
| UX/UI Critic | 사용자 관점 UX 평가, 평가 전 최소 10개 자체 질문 생성 | 불가 |
| QA Engineer | 기능/모바일/브라우저/접근성/입력검증 테스트 | 불가 |
| Optimizer | Auditor·Critic·QA 보고서 기반 실제 수정, 새 기능 임의 추가 금지 | 가능 |

역할별 코드 수정 가능 여부는 `.claude/agents/*.md`의 `tools` 설정으로 강제한다 — 지시문에만 의존하지 않는다. "코드 수정 불가" 역할은 Edit 권한이 없어 기존 소스 코드를 수정할 수 없다. 이 역할들도 자신의 산출물 문서(SPEC/FORMULA/EVALUATION/QA.md)는 작성해야 하므로 Write 권한은 별도로 갖되, 용도를 해당 문서 작성으로만 한정한다.

## Calculation Auditor 검증 범위 (명확화)
Auditor는 두 가지를 모두 검증한다:
1. **구현이 FORMULA.md와 일치하는가** — Builder가 공식을 임의로 바꾸지 않았는지
2. **FORMULA.md 자체가 실제 법령/공식 출처와 일치하는가** — 독립적인 수동 계산, 공식 계산기 대조로 확인

2번에서 FORMULA.md 자체의 오류를 발견하면 Auditor는 이를 구현 결함(Builder FAIL)이 아니라 **공식 재검토 요청**으로 Formula Analyst에게 반려한다. Formula Analyst가 FORMULA.md를 수정하면 Builder가 재구현하고, 다시 Auditor 검증으로 돌아간다.

## 역할 간 이견 조정
- 공식의 정확성(법령 해석 포함) 최종 권위는 Formula Analyst에게 있다. Auditor가 다른 근거를 제시하면 Formula Analyst가 재검토하되, 근거(법령 조항/공식 출처)가 없는 이견은 반영하지 않는다.
- 기술 구조에 대한 이견은 Architect가 최종 결정한다.
- 조정이 안 되는 경우 NEEDS HUMAN REVIEW로 넘긴다 (무한 토론 금지).

## 작업 흐름
```
Product Owner → Formula/Domain Analyst → Architect → Builder
→ Calculation Auditor → UX/UI Critic → QA Engineer → Optimizer → 재검증
```
Builder가 구현을 완료했다고 기능이 완료되는 것이 아니다. Calculation Auditor, Critic, QA 모두 PASS해야 한다. 계산 정확성에 Critical 또는 High가 하나라도 있으면 전체 FAIL이다.

각 역할은 독립적으로 검증한다. Builder가 "정확함/테스트 완료"라고 적어도 Auditor·QA는 이를 그대로 신뢰하지 않고 직접 검증한다.

## 평가 점수 (100점)
| 항목 | 배점 |
|---|---|
| 계산 정확성 | 35 |
| 예외/경계값 처리 | 15 |
| UX/사용 편의성 | 15 |
| 모바일/반응형 | 10 |
| 접근성 | 5 |
| 성능/안정성 | 5 |
| 설명/계산 근거 | 5 |
| SEO/페이지 완성도 | 5 |
| 코드 품질/유지보수성 | 5 |

## PASS 기준
- 총점 92점 이상
- 계산 정확성 33/35 이상
- Critical 0, High 0
- Golden Test 100% PASS
- Console Error 0, TypeScript Error 0
- Mobile Critical Issue 0

총점이 92점을 넘어도 계산 오류가 있으면 PASS가 아니다.

## Issue 등급
- **Critical**: 잘못된 계산 결과, 공식 자체 오류, 심각한 단위 오류, 데이터 손상
- **High**: 특정 정상 입력에서 잘못된 결과, 중대한 반올림 문제, 핵심 모바일 기능 사용 불가
- **Medium**: 일부 UX 문제, 설명 부족, 특정 Edge Case 불편
- **Low**: 사소한 디자인/텍스트/정렬 문제

## 개선 Loop
```
Optimizer 수정 → Calculation Auditor 재검증 → Critic 재검증 → QA 재검증 → 점수 재계산
```
최대 5회. 5회 이후에도 PASS하지 못하면 NEEDS HUMAN REVIEW로 종료한다. 무한 개선 loop를 만들지 않는다.

## 회귀 방지
새 계산기 작업 후 기존 핵심 계산기 Smoke Test를 실행해 기존 계산기를 깨뜨리지 않았는지 확인한다.

## 정책형 계산기 재검토 트리거
기준연도/기준일/출처에 의존하는 계산기는 FORMULA.md에 "다음 재검토 예정일"을 기록한다(법령 개정 시점, 매년 최저임금/세율 고시일 등 기준). PROGRESS.md에도 같은 값을 기록해 추적한다. 재검토 예정일이 지나면 Formula Analyst가 재검토를 시작한다 — 자동 알림은 없으므로 PROGRESS.md 확인이 트리거다.
