# 프로젝트 지침: 온라인 계산기 모음 사이트

이 문서는 세션 운영 규칙과 문서 인덱스만 담는다. 상세 규칙은 각 문서를 참고한다.

## 문서 인덱스
| 문서 | 내용 |
|---|---|
| [docs/GOAL.md](docs/GOAL.md) | 프로젝트 목표 |
| [docs/PRODUCT.md](docs/PRODUCT.md) | 제품 방향, 사용자, 범위, 계산기 우선순위 기준 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 기술 스택, 폴더 구조, 공통 컴포넌트, 데이터/개인정보, SEO/사이트맵 구조 |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | 계산기 UI 공통 규칙 (입력/결과/모바일/접근성) |
| [docs/CALCULATOR_RULES.md](docs/CALCULATOR_RULES.md) | 계산 정확성 규칙 (반올림, 단위, 정밀도, Golden Test, 정책형 계산기) |
| [docs/EVALUATION.md](docs/EVALUATION.md) | 역할 구조, 작업흐름, 평가 점수, PASS 기준, 개선 Loop |

## 역할 기반 개발 체계
이 프로젝트는 한 AI가 구현과 완료 판정을 동시에 하지 않는다. Product Owner → Formula Analyst → Architect → Builder → Calculation Auditor → UX/UI Critic → QA → Optimizer 순서로 역할을 분리하고, 각 역할은 `.claude/agents/*.md`에 정의된 서브에이전트로 실행한다. 역할별 책임과 코드 수정 가능 여부는 해당 파일의 `tools` 권한(지시문이 아니라 실제 툴 제한)으로 강제하며, 세부 내용은 [docs/EVALUATION.md](docs/EVALUATION.md)를 따른다.

## 계산기별 작업 폴더
계산기 하나 = `tasks/{calculator-slug}/` 폴더 하나. 템플릿은 `tasks/_template/`에 있다.
- SPEC.md → FORMULA.md → (구현) → EVALUATION.md → QA.md 순서로 채워진다.
- 진행 상태는 루트 [PROGRESS.md](PROGRESS.md)에서 관리한다.

## 작업 단위
- 한 번에 여러 계산기를 요청하지 말고, 계산기 1개씩 순서대로 진행한다 (Product Owner 단계부터 시작).
- 새 계산기 작업 완료 후 기존 계산기 Smoke Test를 실행한다 ([docs/EVALUATION.md](docs/EVALUATION.md) "회귀 방지" 참고).

## 참고: 이전 형식 문서
`docs/specs/severance-pay.md`는 역할 체계 도입 이전에 작성된 구 형식 스펙이다. 퇴직금 계산기 작업을 재개할 때 이 내용을 `tasks/severance-pay/SPEC.md` + `FORMULA.md`로 이관한다.
