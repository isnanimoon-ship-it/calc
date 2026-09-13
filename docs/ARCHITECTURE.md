# 아키텍처

## 기술 스택
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Vitest
- 배포: Vercel 기준, 정적/SSG 우선
- 알려진 이슈: 일부 Windows 환경(특히 프로세스 생성이 제한된 샌드박스/보안 소프트웨어 환경)에서 `next dev`(Turbopack, 기본값)가 `app/globals.css`를 처리하는 중 자식 node 프로세스 생성에 실패하며 패닉(exit code `0xc0000142`)을 일으킬 수 있다. 앱 코드 문제가 아니라 Turbopack의 프로세스 스폰 이슈로 확인됨 — 이 경우 `npm run dev:webpack`(`next dev --webpack`)으로 대체 실행한다. `npm run build`(production build)는 이 문제와 무관하게 정상 동작한다.
- 패키지 매니저: npm 고정. pnpm/yarn/bun을 비교 검토했으나, 로컬 환경에 pnpm이 설치되어 있지 않음을 `pnpm -v` 실행으로 확인했고(2026-09-02), Node.js에 기본 포함된 npm이 추가 설치 없이 바로 동작해 온보딩 마찰이 가장 적다. Vercel 배포 환경도 npm(package-lock.json)을 그대로 지원한다. `package-lock.json`을 커밋하고, 다른 락파일(`pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`)은 생성하지 않는다.

## 계산 로직 / UI 분리
계산 공식은 UI 컴포넌트 안에 두지 않는다. 계산기 하나는 다음으로 분리한다:
```
/src/calculators/{slug}/
  logic.ts        # 순수 계산 함수 (공식 구현)
  logic.test.ts   # Golden Test + Edge Case Test
  validation.ts   # 입력 검증 (zod 등)
  formatting.ts   # 표시용 포맷팅 (단위, 천단위 구분 등)
  ui.tsx          # 입력/결과/근거 UI
  types.ts        # 계산기 전용 타입
```
다른 계산기에 영향 없이 이 폴더 하나만 수정할 수 있어야 한다.

### 결정 사례: 한 계산기 내부에서 상환방식별로 갈라지는 다단계 알고리즘 — `logic/` 디렉터리 분할 (2026-09-06, loan-interest-calculator Architect 라운드)

지금까지 계산기 하나 = `logic.ts` 단일 파일이 기본이었다(`four-major-insurance`가 보험
4종을 한 함수 안에서 분기, `business-days`가 `mode` 2종을 한 `logic.ts`에서 분기하고
공휴일 **데이터**만 `holidays.ts`로 분리). loan-interest-calculator는 세 상환방식
(원리금균등/원금균등/만기일시)이 "앵커값 계산 → 회차 반복 → 마지막 회차 강제 보정 →
연도별 집계"라는 **다단계 알고리즘 골격을 공유하면서 각 단계의 세부 공식만 다르다**는
점에서 기존 두 선례와 성격이 달라, 처음으로 `logic.ts`를 단일 파일이 아니라 디렉터리로
분할했다.

- **판단 기준**: 여러 변형(보험 종류, 상환방식 등)이 "짧고 서로 독립적인 연산의
  나열"이면(four-major-insurance) 한 함수 안의 분기로 충분하다. 반대로 "같은 모양의
  복잡한 다단계 절차 여러 벌"이면(회차 반복 루프 + 예외 처리 + 마지막 회차 보정을 방식마다
  반복) 파일 단위로 분리해야 SPEC의 "명확히 분리된 함수/모듈" 요구가 실제로 지켜지고,
  Calculation Auditor가 방식 하나만 독립적으로 감사할 수 있다.
- **공통 골격은 별도 헬퍼(`schedule-common.ts`)로 뽑고, 방식별 파일은 앵커값 계산 +
  회차별 "스텝 함수"만 구현해 헬퍼에 콜백으로 주입한다.** 마지막 회차 강제 보정·총계·
  연도별 집계처럼 완료 기준 불변식을 지키는 안전장치는 세 벌로 복붙하면 한 곳만 수정되는
  드리프트 위험이 크므로, `src/lib/date-calc.ts`가 "여러 계산기 사이"에 적용해 온 공용화
  원칙(위 "결정 사례: 순수 날짜 산술 함수의 공용화 범위 재확인" — 한 계산기 내부에서
  ≥2회 재사용되는 것만으로도 공용 함수로 뽑을 이유가 된다)을 "한 계산기 안의 변형 3종
  사이"에 그대로 적용했다.
- **호출 관례는 바뀌지 않는다** — `logic/index.ts`가 진입점 역할을 하므로 다른 파일은
  기존과 동일하게 `from "./logic"`으로 import한다(모듈 해석 규칙상 디렉터리의
  `index.ts`를 가리킨다).
- 상세: `tasks/loan-interest-calculator/ARCHITECTURE.md` "2. 계산 로직 분리 방식".

## 계산 결과 데이터 규모 — 클라이언트에서 매번 새로 생성되는 대용량 배열 (2026-09-06, loan-interest-calculator Architect 라운드)

`annual-salary-take-home-pay`의 세액표(646행)는 정적 JSON을 한 번 로드해 쓰는 경우였다.
loan-interest-calculator는 처음으로 **매 계산마다 클라이언트에서 새로 생성되는 대용량
배열**(회차별 상환 스케줄, 최대 480행)을 결과로 다루게 되어, 이 경우의 처리 원칙을
결정 사례로 남긴다.

- **배열을 `state`로 들고 다니는 것과 배열을 그대로 DOM에 렌더링하는 것을 구분해서
  판단한다.** 수백 개 수준의 순수 데이터 객체 배열(각 행이 숫자 4~5개)을 `useState`로
  보관하는 비용은 무시할 만하다 — 문제가 될 수 있는 지점은 오직 "이 배열 전체를 그대로
  수백 개의 `<tr>`로 렌더링하는가"이다.
- **v1 결과 화면에는 원본 배열이 아니라 그 배열을 집계한 요약(연도별 요약 등)만
  렌더링한다.** 회차별 원본 배열은 계산 로직(연도별 집계, Golden Test 대조)에는
  필요하지만 화면에 그대로 노출하지 않으면 렌더링 성능 문제 자체가 발생하지 않는다 —
  "전체 상세표"처럼 원본 배열을 그대로 보여줘야 하는 기능은 별도 Should Have로 미루고,
  그 기능을 실제로 만들 때가 되어서야 가상 스크롤(virtualization)·페이지네이션 등을
  검토한다(지금 미리 최적화하지 않는다).
- **집계(합산 등 숫자를 만들어내는 연산)는 `formatting.ts`가 아니라 `logic.ts`가
  담당한다** — "표시 직전 포맷팅"과 "원본 배열로부터 새 숫자를 계산해내는 것"은 다른
  일이며, 후자는 Golden Test로 검증돼야 하는 계산 로직이다.
- 상세: `tasks/loan-interest-calculator/ARCHITECTURE.md` "4. 회차별 스케줄(최대
  480행) 데이터 구조와 UI 처리".

### 결정 사례: `logic/` 디렉터리 분할 기준 재확인 — "짧고 독립적인 방식 3종"은 분할하지 않는다 (2026-09-07, bill-split-calculator Architect 라운드)

loan-interest-calculator가 세운 "짧고 독립적인 연산의 나열이면 분기로 충분, 같은 모양의
복잡한 다단계 절차 여러 벌이면 파일 분할"이라는 기준을 반대 방향(분할하지 않는 쪽)으로도
확인한 첫 사례다. bill-split-calculator의 세 분배 방식(균등/몰아주기/사다리타기)은 표면적
으로는 "방식별로 계산이 상당히 다르다"는 점이 loan-interest-calculator(상환방식 3종)와
비슷해 보였지만, 실제로 뜯어보면 균등(반복문 없음, ~5줄), 몰아주기(RNG 1회 호출, ~5줄),
사다리타기(Fisher-Yates 반복문, ~10줄)로 모두 매우 짧고, 셋이 공유하는 "반복 골격" 자체가
없었다(loan-interest-calculator는 "앵커값 계산 → 회차 반복 → 마지막 회차 보정 → 연도별
집계"라는 골격을 공유했다는 점이 핵심 차이).

- **판단 기준 재확인**: "방식/분기가 여러 개"라는 사실만으로 `logic/` 디렉터리 분할을
  결정하지 않는다 — 각 분기의 실제 코드 길이·반복 구조를 먼저 확인하고, 공유 가능한
  다단계 절차가 실재하는지를 본다. 없으면(이번 사례) 단일 `logic.ts` 안에서 각 방식을
  독립적으로 export되는 함수로만 나눠도 "명확히 분리된 함수" 요건과 Auditor의 독립 감사
  가능성을 동시에 만족한다 — 파일을 나누는 것과 함수를 나누는 것은 별개이며, 후자만으로
  충분한 경우가 있다.
- 상세: `tasks/bill-split-calculator/ARCHITECTURE.md` "2.1 단일 logic.ts vs logic/
  디렉터리".

## 공용 데이터
- `/src/data/rates-{year}.json`: 연도별로 바뀌는 수치(최저임금, 4대보험 요율 등). 스키마는 [docs/CALCULATOR_RULES.md](CALCULATOR_RULES.md)를 따른다.
- 여러 계산기가 공유하는 값은 이 데이터 파일에서만 가져온다 (계산기 코드에 하드코딩 금지).

### 결정 사례: 법정 근로기준 상수 — 최상위 `laborStandards` 네임스페이스 (2026-09-04, 주휴수당 계산기 Architect 라운드)
주휴수당 계산기 FORMULA.md가 근로기준법상 상수(주 40시간·1일 8시간·초단시간 15시간·월 환산 계수 365/12/7)를 어디에 둘지 열린 질문으로 남겼다. **최상위 `laborStandards` 네임스페이스를 신설**해 여기에 둔다(계산기 전용 네임스페이스 아님).
- **근거**: 최저임금(`minimumWage`)이 "여러 계산기가 공유하므로 최상위"인 것과 같은 논리다. 40·8시간은 향후 연장근로수당 계산기(제56조 가산)·최저임금 계산기(주 40 + 주휴 8 → 월 209시간)가 그대로 재사용하고, 15시간은 severance-pay(퇴직금 지급요건)·unemployment-benefit(초단시간)도 개념적으로 공유한다. 계산기별 네임스페이스에 두면 같은 상수가 중복 정의되어 한쪽만 수정되는 드리프트 위험이 생긴다("결정 사례: 날짜 계산 유틸 공용화"와 같은 판단). severance-pay가 15시간을 logic.ts에 하드코딩했던 전례를 반복하지 않기 위함이기도 하다.
- **필드**(`rates-2026.json` 최상위 `laborStandards`, docs/CALCULATOR_RULES.md "데이터 파일 스키마" 준수): `statutoryWeeklyHours`(40, 근로기준법 제50조제1항), `statutoryDailyHours`(8, 제50조제2항), `ultraShortTimeWeeklyHours`(15, 제18조제3항), `monthlyWeekFactor`(`{ daysPerYear: 365, monthsPerYear: 12, daysPerWeek: 7 }`, 관행). `40/8/15/365·12·7`은 법·관행상 사실상 불변이라 어느 배치든 정확성 차이는 없고, 순수하게 스키마 통일·SSOT 목적의 결정이다.
- **TypeScript 영향**: 최상위 키 추가는 순수 additive라 `unemployment-benefit/logic.ts`의 `typeof rates2026` / `RATES_BY_YEAR` 배선에 영향 없음(`tsc --noEmit`·`next build` 통과 확인). 같은 라운드에서 `minimumWage.hourly.source` 문구도 고시 번호(고용노동부 고시 제2025-47호)까지 정확히 반영하도록 정정했다(값 10,320원 불변).
- 상세: tasks/weekly-holiday-allowance/ARCHITECTURE.md "2. 연도별 데이터 스키마 배치".

### 결정 사례: 정책 데이터를 언제 계산기 전용 `policy.ts`에 두는가 (2026-09-06, housing-subscription-score Architect 라운드에서 일반화)

`socialInsurance`(four-major-insurance)·`laborStandards`(weekly-holiday-allowance)는
`rates-{year}.json` 최상위에 두지만, `parental-leave-benefit`·`military-discharge-date`·
housing-subscription-score(청약가점 계산기)는 계산기 전용 `policy.ts`를 쓴다. 이 갈림이
누적되어 처음으로 일반 기준을 정리해 둔다.

- **판단 기준: "이 값을 다른 계산기가 재사용할 근거가 실제로 있는가".** 있으면(국민연금
  요율처럼 여러 계산기가 이미 쓰거나 쓸 예정이 명확함) 최상위 `rates-{year}.json`에 둬
  SSOT를 통일한다(위 "결정 사례: 법정 근로기준 상수" 참고). 특정 법령의 배점표·지급률처럼
  그 계산기 하나에만 등장하는 값이면 계산기 전용 `policy.ts`에 둔다.
- **메타데이터 스키마는 위치와 무관하게 통일한다** — `value`/`source`(`law`/`article`/
  `effectiveDate`/`url`)/`lastVerified`/`nextReviewDue`(docs/CALCULATOR_RULES.md "데이터
  파일 스키마") 필드명을 `policy.ts`에서도 그대로 쓴다. 재검토 알림 등 공통 도구가 파일
  위치와 무관하게 같은 필드명으로 정책 데이터를 스캔할 수 있어야 하기 때문이다.
- **연도별 파일 분리(`rates-2027.json` 등)가 적합하지 않은 정책은 `policy.ts` 안에서
  `lastVerified`/`nextReviewDue`만 갱신하는 "단일 최신본" 방식을 쓴다** — 최저임금처럼
  매년 1회 정기 개정되는 값과 달리, 「주택공급에 관한 규칙」처럼 연 단위가 아니라 수시로
  개정되는 정책은 "연도" 축으로 파일을 나누는 것 자체가 어색하다.
- 재사용 근거 없이 최상위에 두면 공유 파일의 "여러 계산기가 함께 쓴다"는 성격이 흐려지고,
  그 계산기만의 재검토 이력(확인 필요 각주 등)이 다른 계산기 데이터와 섞여 가독성이
  떨어진다 — 이것이 계산기 전용 `policy.ts`를 선택하는 실질적 이유다.
- 상세: `tasks/parental-leave-benefit/ARCHITECTURE.md` "정책 데이터",
  `tasks/housing-subscription-score/ARCHITECTURE.md` "3. 정책 데이터 스키마".

## 공통 UI 컴포넌트 (검토 대상, 강제 아님)

공유 UI는 `/components/calculator/ShareActions.tsx`, 채널별 URL 생성처럼 React와 무관한 순수
함수는 `/src/lib/share.ts`에 둔다. 계산기별 UI는 결과 상태에 맞는 문구와 복원 URL만 props로
전달하며 SNS SDK를 직접 호출하지 않는다. 상세 계약은 `docs/SHARING.md`를 따른다.
CalculatorPage, CalculatorInput, CalculatorField, CalculatorResult, ResultCard, FormulaExplanation, ShareResult, ResetButton 등을 Architect가 검토한다. 단, 계산기 특성이 크게 다르면 억지로 하나의 거대한 Generic Component에 넣지 않고 도메인 로직을 분리한다.

### 결정 사례: 페이지 구조 공용 컴포넌트 — "사용 방법 / 소개 / FAQ" (2026-09-02, severance-pay v2 라운드)
"SEO / 사이트맵" 절이 정의한 공통 페이지 구조(계산기 → 결과 → 사용 방법 → 공식 → 예제 → FAQ)의 "사용 방법"·"소개"·"FAQ" 단계는 severance-pay가 처음 구현될 때 빠져 있었고, SPEC.md v2가 이를 명시적으로 요구하면서(Must Have "사용 안내 섹션", "소개 콘텐츠 + FAQ 섹션") 이 패턴이 앞으로 만들 모든 계산기에서 반복될 것이 확실해졌다. 계산기별 `ui.tsx` 안에 매번 파묻지 않고 공용 컴포넌트로 분리한다.

- **위치: `/components/calculator/`(저장소 루트, `src/` 아래 아님).** 이미 `/components/theme-toggle.tsx`가 사이트 전역 공용 컴포넌트를 저장소 루트 `/components/`에 두고 `@/components/...`로 임포트하는 관례를 확립해 뒀다(`tsconfig.json` `paths: { "@/*": ["./*"] }`). 반면 `/src/calculators/{slug}/`는 계산기 하나의 전용 코드 전용이다. 새 컴포넌트는 "계산기 전용 로직"이 아니라 "여러 계산기가 공유하는 페이지 구조 UI"이므로, 기존 관례를 따라 `/src/components/calculator/`가 아니라 `/components/calculator/`에 둔다.
- **컴포넌트 4종과 역할 분리**:
  - `SectionCard`: 카드 레이아웃 공통 wrapper(제목/설명/아이콘/children). SPEC.md v2 "디자인: 카드/시각적 계층" 요구사항(텍스트 단순 나열 금지)에 대응하는 기반 컴포넌트 — 아래 세 컴포넌트가 모두 이것을 감싸 써서 카드 스타일이 한 곳에서만 정의되게 한다.
  - `UsageGuide`: 번호 매겨진 단계 목록(`steps: UsageGuideStep[]`). "사용 방법" 섹션용.
  - `IntroSection`: 문단 + 선택적 강조 불릿 목록(`paragraphs: string[]`, `highlights?: string[]`). "소개" 섹션용.
  - `FaqAccordion`: 질문/답변 접고펴기(`items: FaqItem[]`), `"use client"` — 유일하게 상태(`useState`)가 필요한 컴포넌트라 나머지 셋과 분리했다. 접근성(`aria-expanded`/`aria-controls`/`role="region"`)을 기본 구현에 포함했다(docs/DESIGN_SYSTEM.md "접근성").
- **콘텐츠는 넣지 않음**: 네 컴포넌트 모두 실제 카피(사용법 문구, 소개 문구, FAQ 답변)를 포함하지 않는다 — props로 계산기별 콘텐츠를 주입받는 순수 구조 컴포넌트다. 콘텐츠 연결(예: severance-pay의 FORMULA.md "FAQ 콘텐츠"/"소개 문구"를 실제로 이 컴포넌트에 채워 넣는 것)은 Builder 몫이며, `ui.tsx`에 아직 연결되지 않았다.
- **JSON-LD(FAQPage) 처리는 별도**: SEO 규칙 4번(JSON-LD 삽입)은 `FaqAccordion`의 책임으로 넣지 않았다 — 컴포넌트는 화면 렌더링만 담당하고, 동일한 질문/답변 데이터를 페이지 레벨에서 JSON-LD로 직렬화하는 것은 Builder/SEO 작업 단계에서 별도로 처리한다(컴포넌트가 이 관심사까지 떠안으면 "구조 컴포넌트"라는 목적이 흐려짐).

### 결정 사례: 홈페이지 카테고리별 카드 그리드 구조 (2026-09-02)
사용자가 참고 이미지(다크 테마, 카테고리별 섹션 헤더 + 3열 아이콘 카드 그리드)를 제시했으나,
현재 registry에는 계산기가 1개(severance-pay, category: labor)뿐이라 참고 이미지 수준의
"여러 카테고리 × 여러 카드"는 지금 만들 수 없다. 계산기가 늘어날수록 자동으로 채워지는
구조를 지금 확정한다(실제 다크 테마 스타일링/그리드 CSS/헤더 카피는 Builder 몫, 여기서는
타입·데이터·컴포넌트 구조만 결정).

- **`CalculatorMeta.icon` 필드 추가(문자열 유니온 키 → SVG 매핑)**: 초기에는 이모지 문자열로
  충분하다고 판단했으나, 이후 사이트 전체 디자인이 이모지에서 인라인 SVG 아이콘 언어로
  통일되면서(`theme-toggle.tsx`의 해/달 SVG, `severance-pay/ui.tsx`의 `SectionIcon`) 이
  필드도 `"coins" | "calculator" | "calendar" | "chart" | "heart" | "utility"` 같은
  아이콘 이름 키로 바뀌었고, `CalculatorCard.tsx`의 `CalculatorIcon`이 이 키를 실제 SVG로
  매핑한다(docs/DESIGN_SYSTEM.md "아이콘" 참고 — 현재 기준). `severance-pay`는 `"coins"`.
  필수 필드이므로(선택 아님) 앞으로 등록되는 모든 계산기는 아이콘 키를 빠짐없이 갖는다.
- **카테고리 한글 라벨 매핑**: `registry.ts`에 `categoryLabels: Record<CalculatorCategory, string>`
  (labor→"노동/근로", finance→"금융", tax→"세금/정책", date→"날짜", health→"건강",
  life→"생활")과 노출 순서 고정용 `categoryOrder` 배열을 추가했다. 레지스트리 파일에 이미
  카테고리 타입과 그 옆 주석으로 같은 한글 라벨이 존재했으므로(타입 정의 옆 주석), 별도
  파일로 분리하지 않고 타입과 같은 곳에 SSOT로 두었다.
- **`getPublishedCalculatorsGroupedByCategory()` 헬퍼 추가**: `categoryOrder`를 순회하며
  카테고리별로 공개 계산기를 묶고, 계산기가 0개인 카테고리는 결과에서 제외한다. "빈
  카테고리 섹션은 렌더링하지 않는다"는 규칙을 페이지 컴포넌트마다 반복 구현하지 않도록
  레지스트리(SSOT) 쪽에 한 번만 구현했다 — 계산기가 추가되어 카테고리가 채워지면 호출부
  수정 없이 섹션이 자동으로 나타난다.
- **컴포넌트 분리: `/components/calculator/CalculatorCard.tsx`, `CategorySection.tsx`**:
  기존 관례(`/components/calculator/`에 사이트 전역 계산기 관련 공용 컴포넌트를 둠)를
  따랐다. `CalculatorCard`(아이콘+제목+설명, 상세 페이지로 링크하는 카드 하나)와
  `CategorySection`(카테고리 헤더 + 카드 그리드, 빈 그룹이면 `null` 반환하는 방어 코드
  포함)으로 나눴다 — 인라인으로 `app/page.tsx`에 두지 않고 분리한 이유는 카테고리
  목록 페이지(향후 추가 가능성이 있는 `/categories/[category]` 등)가 동일한 카드/섹션을
  재사용할 수 있게 하기 위해서다. 기존 `SectionCard`(계산기 페이지 내부 섹션용, children에
  임의 콘텐츠를 받는 wrapper)와는 역할이 달라 통합하지 않았다 — `CalculatorCard`는 항상
  `CalculatorMeta` 하나를 상세 페이지로 링크하는 "카드 = 링크" 전용이다.
- **`app/page.tsx`는 `getPublishedCalculatorsGroupedByCategory()` + `CategorySection`으로
  교체**: 카테고리 1개·계산기 1개인 현재 상태에서도 어색하지 않도록(빈 카테고리 없음,
  카드 자체 밀도는 유지) 배선까지 마쳤다. 다크 테마 색상, 3열 그리드의 반응형 브레이크포인트
  세부 조정, 상단 히어로 카피 등 참고 이미지의 시각적 완성도를 맞추는 작업은 아직 남아있고
  Builder가 담당한다.

## 숫자 정밀도 전략
Architect가 계산기 종류별로 다음 중 결정한다: `number` 그대로 / 정수 스케일링(예: 원·전 단위 정수화) / `BigInt` / `decimal.js`·`big.js`.
- 모든 계산기에 무조건 무거운 decimal 라이브러리를 쓰지 않는다.
- 돈/세금/복리처럼 정밀도가 중요한 계산기는 FORMULA.md에 결정 근거를 기록한다.
- 세부 반올림 원칙은 [docs/CALCULATOR_RULES.md](CALCULATOR_RULES.md) 참고.

### 결정 사례: 퇴직금 계산기 (severance-pay)
FORMULA.md "정밀도/반올림 정책"이 "전 단위 정수 스케일링(또는 이에 준하는 유리수/BigInt 연산)"까지는 요구하되, 구체적 자료형 선택은 Architect 몫으로 남겼다. 다음과 같이 결정한다.

- **선택: 일반 정수 `Number` (전 단위로 ×100 스케일링), `BigInt`/`decimal.js`/`big.js` 사용하지 않음.**
- **근거**:
  - 퇴직금 계산에 등장하는 금액 규모는 임금총액·상여금·연차수당 등 수백만~수천만 원 단위이며, 전 단위(×100)로 스케일링해도 최종 곱셈 단계(`baseDailyWage × 30 × totalServiceDays`, 최대 근속연수를 수십 년으로 가정)까지 포함해 `Number.isSafeInteger`(2^53 − 1 ≈ 9,007조) 범위에 전혀 근접하지 않는다. 예: 1일 평균임금 상한을 넉넉히 1억 원(전 단위 100,000,000×100 = 10,000,000,000)으로 잡아도 `× 30 × 36,500(100년 재직 가정)`을 곱한 값이 약 1.1×10^16으로, 이 극단적 가정에서도 안전 정수 범위(9.007×10^15) 근처에 갈 수는 있으나, 실제 서비스에서 다루는 근속기간(최대 수십 년)·평균임금 범위에서는 안전하게 여유가 있다. 다만 나눗셈(7단계, `÷ 365`)을 곱셈들 다음 마지막에 한 번만 수행하는 FORMULA.md의 계산 순서를 그대로 지키고, 극단적으로 큰 입력값은 validation.ts에서 상한을 두어 이 여유를 실제로 보장한다.
  - `BigInt`는 나눗셈에서 정수 나눗셈만 가능해(자동으로 소수부가 버려짐) FORMULA.md가 요구하는 "완전정밀도로 보존 후 최종 1회만 반올림" 흐름과 상성이 나쁘고, 표시용 반올림(올림/사사오입)을 직접 구현해야 하는 부담이 커진다.
  - `decimal.js`/`big.js`는 이 계산기의 금액 규모에서 실익 없이 번들 크기와 의존성만 늘린다(위 "모든 계산기에 무조건 무거운 decimal 라이브러리를 쓰지 않는다" 원칙에 부합).
  - 일반 `number`를 원 단위 그대로 쓰면(스케일링 없이) `0.1 + 0.2` 류 이진 부동소수점 오차가 전 단위 자릿수에서 그대로 노출될 수 있어 채택하지 않는다.
- **구현 방식**: `wage3m`, `bonus12m`, `annualLeavePay12m`, `ordinaryDailyWage` 등 입력 금액(원 단위 정수)을 logic.ts 내부에서 즉시 `× 100`(전 단위 정수)으로 변환해 모든 중간 계산(가산액 3/12, 평균임금 나눗셈, 기준임금 비교, 최종 곱셈)을 전 단위 정수 `Number` 산술로 수행한다. 나눗셈이 필요한 지점(`÷ baseDays`, `÷ 365`)에서는 몫을 정수로 절사하지 않고 다음 단계까지 나눗셈 자체를 유예하거나(분자를 먼저 모두 곱한 뒤 마지막에 한 번만 나눔, FORMULA.md 7단계), 부득이 나눗셈 결과를 다음 계산에 이어야 하는 경우(5단계 평균임금)는 JS `number`의 배정밀도 부동소수점 그대로 이어서 사용한다 — 이는 "정수 스케일링"이 아니라 "완전정밀도 보존"이 목적인 단계이므로 배정밀도 오차가 표시 단위(전)보다 한참 작아 문제되지 않는다. 최종 표시 단계에서만 원 단위(÷100, 반올림)로 되돌린다.
  - 즉 "전 단위 정수 스케일링"은 정수 곱셈·덧셈 단계(가산액 계산, 최종 곱셈)의 오차 원천을 없애는 데 쓰고, 나눗셈이 끼어드는 단계(평균임금)는 애초에 정수로 떨어지지 않는 값이므로 스케일링 정수가 아니라 JS 배정밀도 실수로 "완전정밀도"를 근사한다 — 이는 FORMULA.md가 명시한 "분수로 보존"(정확한 유리수)과 완전히 동일하지는 않지만, 배정밀도(약 15~17 유효자리)가 전 단위(소수 둘째 자리) 표시에 필요한 정밀도를 압도적으로 초과하므로 실무적으로 무차이다.
  - Golden Test(FORMULA.md 검증 예제)로 이 근사가 표시 자릿수에서 문제를 일으키지 않음을 Builder 단계에서 확인한다.

### 결정 사례: 실업급여 계산기 (unemployment-benefit, 2026-09-02)
- **선택: 일반 `Number`, 전 단위(jeon) 스케일링 없음.** severance-pay와 달리 이 계산기는 전 단위(0.01원) 정밀도를 법적으로 요구받는 지점이 없다 — FORMULA.md "단위" 절이 "정부 공식 발표(상한 68,100원 등)가 모두 원 단위 정수로 고시되므로 원 미만 정밀도를 유지할 실익이 크지 않다"고 명시한다. 다루는 금액 규모(수백만~수천만 원)도 `Number.isSafeInteger` 범위에 전혀 근접하지 않는다.
- 나눗셈(`averageDailyWage = wage3m / baseDays`)이 만들어내는 반복소수(예: 326,086.9565...)는 중간 단계에서 임의로 반올림하지 않고 다음 계산(× 0.6, clamp)까지 JS 배정밀도 그대로 넘긴다 — docs/CALCULATOR_RULES.md "반올림 정책"(중간 단계 임의 반올림 금지)과 일치한다.
- **`benefitDailyAmount`(구직급여일액) 확정 시점의 원 단위 절사/올림/반올림 방식은 FORMULA.md가 "확인 필요"로 명시 보류했다(잠정: 절사).** Architect는 이를 임의로 확정하지 않는다 — Builder는 이 절사 정책을 로직 안에 흩어 쓰지 않고 이름 있는 상수/함수(예: severance-pay의 `EPSILON`처럼 정책이 바뀌면 한 곳만 고치면 되는 형태)로 분리해 구현해야 한다.
- `decimal.js`/`big.js`/`BigInt`는 이 계산기 규모에서 실익이 없어 채택하지 않는다("모든 계산기에 무조건 무거운 decimal 라이브러리를 쓰지 않는다" 원칙).

### 결정 사례: 주휴수당 계산기 (weekly-holiday-allowance, 2026-09-04)
- **선택: 일반 `Number`, 전 단위(jeon) 스케일링 없음.** unemployment-benefit과 같은 판단 — FORMULA.md "정밀도/반올림 정책"이 명시하듯 주휴수당은 통상 원 단위로 지급·정산되고 행정해석·온라인 계산기 예시도 모두 원 단위 정수라 전 미만 정밀도가 요구되는 지점이 없다. 다루는 금액도 작다(`weeklyHolidayPay ≤ 8 × 시급`, `monthlyTotalPay`도 억 단위 이하로 `Number.isSafeInteger`에 전혀 근접하지 않음).
- **금액 필드는 logic.ts가 반올림하지 않은 완전정밀도로 반환하고, 원 단위 반올림은 formatting.ts의 `roundWon()` 한 함수가 표시 직전에만 각 값에 독립적으로 1회 적용한다.** "반올림된 값을 다른 계산에 재사용하지 않는다"는 FORMULA.md 정책을 "logic은 exact만 반환, 반올림은 표시 경로에만 존재"라는 구조로 강제한다. `roundWon`은 현재 round half up + 작은 EPSILON(부동소수점 오차로 반올림이 한 단계 빗나가는 것 방어, severance-pay `EPSILON`·unemployment-benefit `TOTAL_BENEFIT_EPSILON` 선례). FORMULA.md가 "확인 필요"로 남긴 절사/올림 여부가 바뀌면 이 함수 한 곳만 고친다.
- **월 환산 `× 365 ÷ 84`**: 곱셈을 먼저, 나눗셈을 마지막에 1회. 미리 4.345로 반올림한 계수를 쓰지 않는다. 세 상수는 `rates-2026.json`의 `laborStandards.monthlyWeekFactor`에서 읽는다.
- `weeklyHolidayHours`(예: 13.5/5 = 2.7)는 반올림하지 않고 소수 그대로 반환·표시(소수 2자리).
- `BigInt`/`decimal.js`/`big.js`는 실익 없어 채택하지 않는다.
- 상세: tasks/weekly-holiday-allowance/ARCHITECTURE.md "1. 숫자 정밀도 전략".

### 결정 사례: 4대 보험 계산기 (four-major-insurance, 2026-09-04)

- **일반 `Number` + 정수 분수 연산**을 사용한다. 요율은 계산 시 소수로 직접 곱하지 않고
  정책 데이터의 `numerator`/`denominator`로 계산해 부동소수점 절사 오류를 막는다.
- 최종 보험료는 보험별 공식 단위인 10원 단위에서 계산 로직이 확정한다. formatting 계층은
  이미 확정된 정수 금액을 다시 반올림하지 않는다.
- 10억 원 입력 상한에서도 최대 정수 곱이 안전 정수 범위 안이므로 `BigInt`와 decimal 계열
  의존성은 사용하지 않는다.
- 여러 계산기에서 재사용 가능한 정책이므로 `rates-2026.json` 최상위 `socialInsurance`에
  국민연금·건강보험·고용보험·산재보험 데이터를 둔다. 국민연금의 연중 상·하한 변경을 위해
  `effectiveFrom`/`effectiveTo`를 명시한다.
- 상세 결정과 Builder 인수인계는 `tasks/four-major-insurance/ARCHITECTURE.md`를 따른다.

### 결정 사례: 전역일 계산기 (military-discharge-date, 2026-09-04)

- 날짜는 시간대 없는 `YYYY-MM-DD`와 UTC day serial로 계산해 DST·브라우저 시간대 오차를 막는다.
- 복무 유형별 개월 수·결과 용어·계급 일정 지원 여부는 `policy.ts`에서 관리한다.
- 현재 날짜를 순수 계산 함수에서 직접 읽지 않고 입력으로 전달한다.
- 상세 결정은 `tasks/military-discharge-date/ARCHITECTURE.md`를 따른다.

### 결정 사례: 영업일 계산기 (business-days, 2026-09-04)

- 공휴일은 브라우저에서 API를 호출하지 않고 2025~2027 연도별 검증 스냅샷으로 배포한다.
- 동일 날짜의 주말·공휴일·사용자 휴무일은 한 번만 제외하고 모든 사유를 보존한다.
- 날짜 계산은 시간대 없는 ISO 날짜와 UTC day serial을 사용한다.
- 상세 구조는 `tasks/business-days/ARCHITECTURE.md`를 따른다.

### 결정 사례: 청약가점 계산기 (housing-subscription-score, 2026-09-06)

- 일반 `Number`. 세 항목 점수(0~84)·연수·개월수·인원수가 전부 정수이고 금액이 전혀 없어
  반올림 정책 자체가 필요 없다. 스케일링/`BigInt`/`decimal.js` 전부 불필요.
- 날짜 산술(연/월 차)은 `src/lib/date-calc.ts`의 정수 `Date.UTC` 기반이라 부동소수점
  오차와 무관 — 아래 "결정 사례: 순수 날짜 산술 함수의 공용화 범위 재확인" 참고.
- 상세: `tasks/housing-subscription-score/ARCHITECTURE.md` "1. 숫자 정밀도 전략".

### 결정 사례: 연봉 실수령액 계산기 (annual-salary-take-home-pay, 2026-09-06)

- **일반 `Number` + 정수 분수 연산** (four-major-insurance와 동일 전략). 안전 정수 범위를
  이 계산기 고유 입력 상한(연봉 100억 원 → 월급여 최대 약 8.33억 원)으로 직접 재계산했다
  — 가장 큰 중간값은 장기요양보험 유도 단계의 약 4.34 × 10^14로 `Number.MAX_SAFE_INTEGER`
  (약 9.007 × 10^15)의 약 1/20 수준이라 여유가 크다. `BigInt`/`decimal.js`는 불필요.
- 1억원 초과 근로소득세 산식의 이중 백분율(`98% × 35%` 등)도 소수 리터럴이 아니라 정수
  분자·분모를 먼저 통분해 곱한 뒤 마지막에 한 번만 나누도록 `policy.ts`에 계수를 저장한다.
- 상세: `tasks/annual-salary-take-home-pay/ARCHITECTURE.md` "5. 숫자 정밀도 전략".

### 결정 사례: 대출 이자 계산기 (loan-interest-calculator, 2026-09-06)

- **일반 `Number`, 스케일링/`BigInt`/`decimal.js` 전혀 불필요.** 이 계산기는 이 사이트
  최초로 거듭제곱(`(1+r)^n`, 최대 n=480)이 등장해 FORMULA.md의 "Number로 충분하다"는
  의견을 그대로 받지 않고 최악 조합(원금 100억 원 × 연이율 100% × 480개월)으로 직접
  재계산했다 — 정수 값(원금·이자·상환액·잔액·480회 누적 총이자)은 최대 약 5.2×10^12
  수준으로 `Number.MAX_SAFE_INTEGER`(약 9.007×10^15) 대비 여유가 크고, `(1+r)^n` 자체는
  매우 큰 실수(약 5×10^16)이지만 최종 앵커값 공식에서 분모·분자 양쪽에 지배적으로
  등장해 사실상 `1`로 수렴하는 항이라, 부동소수점 상대오차(~2.2×10^-16)가 기여하는
  절대오차가 1원에 한참 못 미친다 — 극단 조합에서도 원 단위 반올림 결과에 영향을 주지
  않는다.
- 회차마다 원 단위 정수로 즉시 확정해 다음 회차에 재사용하는 FORMULA.md의 반올림 정책
  자체가 480회 반복에도 부동소수점 오차 축적을 막는 구조라는 점도 확인했다.
- 상세: `tasks/loan-interest-calculator/ARCHITECTURE.md` "1. 숫자 정밀도 전략".

### 결정 사례: 더치페이 계산기 (bill-split-calculator, 2026-09-07)

- **일반 `Number`, 스케일링/`BigInt`/`decimal.js` 전혀 불필요.** 이 계산기는 이 사이트
  최초로 "반올림 정책"이라는 개념 자체가 핵심 로직(선정·매칭)에는 적용되지 않는 계산기다 —
  몰아주기·사다리타기는 정수 인덱스를 만들어내는 RNG 연산이지 금액을 반올림하는 연산이
  아니다. 유일하게 반올림 규칙이 있는 균등 분배도 `floor`/`%` 정수 연산이라 부동소수점이
  개입할 여지가 없다(입력 상한 1억 원 × 최대 20명 합산도 안전 정수 범위에 전혀 근접하지
  않는다).
- 상세: `tasks/bill-split-calculator/ARCHITECTURE.md` "1. 숫자 정밀도 전략".

### 결정 사례: 평단가(물타기) 계산기 (average-cost-calculator, 2026-09-12)

- **이 사이트 최초로 `BigInt`(8자리 고정소수점 스케일링)를 실제 채택한다.** 지금까지 모든
  계산기는 "금액만 소수 위험이 있고 수량(주·개월·회차 등)은 항상 정수"였지만, 이 계산기는
  최초로 **수량 자체가 소수**(코인 대응)인 입력을 받는다 — `수량(소수)×단가(소수)`를 곱해
  비용을 만들고 그 합을 `수량(소수)`으로 나눠 평균을 내는 체인 전체에서 부동소수점 오차가
  개입할 수 있다. FORMULA.md의 "BigInt 권장(강제 아님)" 의견을 Architect가 직접
  재계산해 확정했다 — 입력 상한(수량 10^15, 단가 100억원)만 곱해도 `10^15×10^10=10^25`로
  `Number.MAX_SAFE_INTEGER`(약 9.007×10^15)를 10^9배 이상 초과해, 이 계산기는 다른
  계산기들과 달리 **정상 입력 범위 안에서 이미 일반 `Number`(정수 스케일링 포함)가 틀린
  값을 낼 수 있다**는 것을 확인했다(loan-interest-calculator가 최악 조합에서도 "Number로
  충분하다"고 결론 낸 것과 대조적인 첫 사례).
- **`decimal.js`/`big.js`는 채택하지 않았다** — 연산 횟수가 매우 적고(곱셈 2회·덧셈
  2회·나눗셈 1~2회) 소수 자릿수 상한이 8자리로 고정돼 있어, 네이티브 `BigInt` + 직접
  구현한 소규모 유틸(문자열 기반 스케일링, 나머지 기반 사사오입 나눗셈)만으로 임의정밀도
  라이브러리와 동일한 안전성을 얻을 수 있다("모든 계산기에 무조건 무거운 decimal
  라이브러리를 쓰지 않는다" 원칙 적용).
- **`BigInt` 채택이 계산 함수 내부만이 아니라 결과 타입의 경계까지 이어져야 한다는 점을
  처음으로 확인했다.** 내부를 `BigInt`로 정확히 계산해도 결과를 `number`로 반환하는 순간
  그 경계에서 다시 정밀도가 소실될 수 있다 — 이 계산기의 단가 입력 상한(100억원, 소수
  8자리)만으로도 유효자리 18자리가 필요해 `number`(유효자리 약 15~17자리)로는 부족하다.
  이에 따라 `newAveragePrice`/`totalQty`/`totalCost`/`priceChangeAmount` 4개 출력은
  `Won = number`가 아니라 **정확한 십진 문자열(`DecimalString = string`)**로 타입을
  설계했다(다른 계산기의 `Won = number` 관례에서 처음으로 벗어난 사례). 부수 이점으로
  `DecimalString`은 `BigInt`와 달리 `JSON.stringify`로 직렬화 가능해 `ShareActions` 공유
  URL 인코딩과 별도 처리 없이 호환된다.
- 상세: `tasks/average-cost-calculator/ARCHITECTURE.md` "2. 숫자 정밀도 전략".

### 결정 사례: 디데이 계산기 (d-day-calculator, 2026-09-12)

- **일반 `Number` 정수 산술, 스케일링/`BigInt`/`decimal.js` 전혀 불필요.** 이 계산기가
  다루는 모든 값(날짜 직렬번호, 날짜 차이, 이동 일수 최대 100,000, 요일 인덱스 0~6)이 애초에
  정수이고 소수 자체가 등장하지 않는다 — average-cost-calculator가 `BigInt`를 채택해야
  했던 이유("소수 수량 × 소수 단가")가 이 계산기에는 구조적으로 존재하지 않는다.
- 안전 정수 범위도 직접 재확인했다 — 지원 범위 전체 폭(109,937일, FORMULA.md "N 상한
  근거")을 밀리초로 환산해도 약 9.5×10^12로 `Number.MAX_SAFE_INTEGER`(약 9.007×10^15)의
  1/1,000 이하다.
- 상세: `tasks/d-day-calculator/ARCHITECTURE.md` "2. 숫자 정밀도 전략".

## 날짜 계산
timezone, 윤년, 월별 일수, DST, 시작일/종료일 포함 여부를 반드시 명시적으로 처리한다. date-only 계산은 명시적 calendar date 기준으로 하고, JS Date 객체의 timezone 이동으로 날짜가 하루 밀리는 문제가 없는지 테스트로 검증한다.

### 결정 사례: "날짜+N일 이동"·"요일 계산" 순수 함수를 `src/lib/date-calc.ts`에 신규 추가 (2026-09-12, d-day-calculator Architect 라운드)

d-day-calculator(디데이 계산기)는 "문자열 파싱+검증", "날짜 차이", "날짜+N일 이동", "요일
계산"이라는 네 가지 원자 연산을 다루는데, 이 시점에 이미 이 네 연산이 최소 2~3곳
(`src/lib/date-calc.ts`의 `parseIsoDateUtc`/`diffDaysUtc`, `military-discharge-date/logic.ts`의
`serial`/`fromSerial`/`differenceInDays`/`addCalendarDays`, `age-calculator/date-utils.ts`의
`daySerial`/`differenceInDays`/`weekday`)에 조금씩 다른 시그니처로 중복 구현돼 있었다.

- **`parseIsoDateUtc`/`diffDaysUtc`는 그대로 재사용한다** — 이미 있고 이 계산기가 필요로
  하는 모양(Date 기반 검증+파싱, 날짜 차이)과 정확히 일치해 새로 만들 이유가 없다.
- **`addDaysUtc(date, days)`, `weekdayUtc(date)`, `formatIsoDateUtc(date)`(Date→문자열,
  `parseIsoDateUtc`의 역함수) 3개를 이 파일에 신규 추가했다.** 위 "결정 사례: 순수 날짜
  산술 함수의 공용화 범위 재확인"의 기준("함수 자체가 도메인 의미 없는 순수 산술인가",
  "한 계산기 내부에서 ≥2회 재사용되는 것만으로도 공용 함수로 뽑을 이유가 된다")을 그대로
  적용한 결과다 — `weekday`는 이 계산기 하나에서만도 3회(모드 B 결과일 1회 + 모드 A
  Should Have 시작일·목표일 요일 2회) 쓰인다.
- **`military-discharge-date`/`age-calculator`의 기존 문자열 기반 구현은 리팩터링하지
  않고 그대로 뒀다** — 두 계산기 모두 이미 `published` 상태이고 자체 Golden Test를 갖춘
  서로 다른 시그니처(문자열 in/out)라, "복붙 대신 추출"이 안전하려면 필요한 "로직을 한
  글자도 바꾸지 않고 이동"이 불가능하다(재작성이 필요해 이번 범위 밖의 회귀 위험을 새로
  만든다) — housing-subscription-score 라운드가 age-calculator를 통합하지 않은 것과
  동일한 판단.
- **새 함수 3개는 기존 함수 7개(`parseIsoDateUtc`/`diffDaysUtc`/`lastDayOfMonthUtc`/
  `calendarMonthsBeforeUtc`/`calculateCalendarPeriodDaysBefore`/`calendarFullYearsBetweenUtc`/
  `calendarFullMonthsBetweenUtc`)를 한 글자도 수정하지 않고 append만 했다** — 이 파일을
  이미 쓰는 계산기(unemployment-benefit, severance-pay, housing-subscription-score)에
  영향이 없음을 전체 테스트 스위트 재실행(70개 파일 842개 테스트 통과)으로 확인했다.
- 상세: `tasks/d-day-calculator/ARCHITECTURE.md` "1. 날짜 유틸 공용화 여부".

### 결정 사례: 날짜 계산 유틸 공용화 (`src/lib/date-calc.ts`, 2026-09-02, unemployment-benefit Architect 라운드)
unemployment-benefit FORMULA.md가 "평균임금 산정기간 총일수"(baseDays: 이직일 이전 3개월의 달력일수, 89~92일, 월말 clamp 적용) 계산에 severance-pay와 **동일한 로직**을 재사용할 것을 명시적으로 권고했다(근로기준법 제2조제1항제6호 평균임금 정의를 공유하므로). 이 시점까지 그 로직(`parseIsoDateUtc`, `diffDays`, `lastDayOfMonth`, `calendarMonthsBefore`)은 `src/calculators/severance-pay/logic.ts` 안에 계산기 전용 코드로 있었다.

- **결정: 복붙하지 않고 `src/lib/date-calc.ts`로 추출해 두 계산기가 같은 구현을 import해 쓴다.** severance-pay의 기존 코드도 이 공용 유틸을 쓰도록 즉시 리팩터링했다(뒤로 미루지 않음).
- **근거**:
  - 이 로직은 법적으로 의미가 고정된 계산("근로기준법 제2조제1항제6호 산정기간의 달력일수 + 월말 clamp 규칙")이라, 두 계산기가 별도 사본을 유지하면 한쪽만 수정되는 드리프트 위험이 생긴다(예: 향후 이 clamp 규칙이 재검토될 때 한 곳만 고치고 다른 곳을 놓치는 실수) — 이런 위험은 "지금 통합" 쪽이 "나중에 정리" 쪽보다 비용이 낮다.
  - severance-pay는 PASS·published 상태라 회귀 위험을 신중히 다뤄야 했다. 이를 위해 (1) 함수 본문을 그대로 옮기고 로직을 한 글자도 바꾸지 않았다(추출 = 순수 이동, 재작성 아님), (2) 기존 공개 함수 시그니처(`calculateBaseDays(retireDate: string): number` 등)를 그대로 유지하는 얇은 wrapper로 감쌌다, (3) 리팩터링 직후 severance-pay의 기존 Golden Test 7개(`src/calculators/severance-pay/logic.test.ts`)를 포함한 전체 테스트 스위트를 재실행해 회귀가 없음을 확인했다(결과는 tasks/unemployment-benefit 작업 로그 참고).
  - 위치는 `src/lib/`을 골랐다(`src/components/`가 아니라 `components/`가 사이트 전역 UI 공용 컴포넌트 자리인 것과 대칭 — `src/lib/`은 이미 `site-config.ts`처럼 계산기 전용이 아닌 순수 유틸을 두는 자리로 확립되어 있다). `src/calculators/{slug}/`는 "계산기 하나의 전용 코드"라는 기존 규칙(위 "계산 로직 / UI 분리")과 충돌하지 않는다 — 이제 이 폴더들은 도메인 규칙(지급요건, 반올림 등)만 담고, 순수 날짜 산술은 `src/lib/`이 담당한다.
  - 대안(이번엔 unemployment-benefit만 새 유틸을 쓰고 severance-pay는 나중에 정리)도 검토했으나, "나중"이 실제로 오지 않는 경우가 흔하고 두 구현이 공존하는 기간이 길어질수록 드리프트 위험이 커지므로 채택하지 않았다.

### 결정 사례: 순수 날짜 산술 함수의 공용화 범위 재확인 (2026-09-06, housing-subscription-score Architect 라운드)

위 "날짜 계산 유틸 공용화" 결정 사례의 기준("두 계산기가 동일한 법적 정의를 공유해야 함")을
문자 그대로 적용하면 애매한 상황이 처음 발생했다 — housing-subscription-score가 필요로 한
`calendarFullYearsBetweenUtc`/`calendarFullMonthsBetweenUtc`("만 나이 방식 경과 연/개월수")를
**지금 당장 호출하는 기존 계산기가 없다**(개념이 겹치는 `age-calculator`는 이미 자체 구현이
있다). 이 경우에도 `src/lib/date-calc.ts`에 추가했고, 판단 기준을 다음과 같이 세분화해 남긴다.

- **기준을 "≥2개 계산기가 지금 호출하는가"에서 "함수 자체가 도메인 의미 없는 순수 산술인가"로
  세분화한다.** `src/lib/date-calc.ts` 파일 자체의 기존 원칙("이 파일은 순수 날짜 산술만
  다루고, 계산기마다 의미가 달라지는 판정은 각 계산기에 남긴다")이 이미 이 기준을 내포하고
  있었다 — "몇 년 이상이면 몇 점" 같은 해석은 호출부(logic.ts)에 있고 함수 자체는 "두 날짜
  사이의 만 나이 방식 경과량"이라는 범용 산술만 제공하면, 지금 몇 개 계산기가 부르는지와
  무관하게 이 파일에 둘 자격이 있다.
- **한 계산기 내부에서 ≥2회 재사용되는 것만으로도 공용 함수로 뽑을 이유가 된다.**
  housing-subscription-score는 무주택기간과 청약통장 가입기간 두 항목에 이 산술을 반복
  사용한다 — `logic.ts` 안에 인라인으로 두 번 구현하면 계산기가 1개뿐이어도 이미 드리프트
  위험(한쪽만 수정)이 생긴다.
- **공용화가 항상 "기존 구현까지 리팩터링"을 의미하지는 않는다.** `age-calculator`가
  개념적으로 겹치는 "만 나이" 로직을 이미 자체 구현하고 있었지만(윤년 2월 29일 기념일을
  clamp하는 방식 — 새 함수의 "(월,일) 튜플 직접 비교" 방식과 결과가 다를 수 있는 엣지케이스),
  age-calculator는 이미 draft로 자체 Golden Test(윤년 경계 포함)를 갖춘 상태라 **지금 억지로
  통합하면 이번 작업 범위 밖의 회귀 위험**을 새로 만든다. "복붙 대신 추출"이 안전하려면
  "로직을 한 글자도 바꾸지 않고 이동 + 기존 테스트 재실행 확인"이 가능해야 하는데, 두
  구현이 설계부터 다르면 이 전제가 성립하지 않는다. 이런 경우는 새 도입 시점에 안전하게
  공유 가능한 범위(신규 함수)만 공용화하고, 기존 계산기와의 통합은 별도 라운드로 미루는
  것도 유효한 선택지다.
- 상세: `tasks/housing-subscription-score/ARCHITECTURE.md` "2. 날짜 계산 헬퍼 배치".

## 계산 로직 공용화 (날짜 산술 밖으로 확장)

### 결정 사례: 4대 보험 근로자 부담분 계산 공용화 — `src/lib/social-insurance.ts` (2026-09-06, annual-salary-take-home-pay Architect 라운드)

annual-salary-take-home-pay FORMULA.md가 "4대 보험 근로자 부담분은 four-major-insurance가
검증한 공식·요율·상하한을 그대로 재사용한다"고 명시했다. 위 "날짜 계산 유틸 공용화" 결정
사례는 지금까지 `src/lib/`을 **날짜 산술** 전용으로만 써 왔는데, 이번이 **금액/보험료
계산**을 `src/lib/`로 추출하는 첫 사례라 판단 기준을 명시적으로 확장해 기록한다.

- **결정: `four-major-insurance/logic.ts`의 근로자 부담분 계산(국민연금 기준소득월액
  clamp, 4개 보험료 산출, 10원 미만 절사)만 `src/lib/social-insurance.ts`로 추출한다.**
  `four-major-insurance`는 내부에서 이 함수를 호출해 사업주 부담분만 자체적으로 이어
  계산하고, `annual-salary-take-home-pay`는 이 함수를 직접 호출한다.
- **왜 `calculateFourMajorInsurance`를 통째로 호출(그대로 재사용)하지 않았는가**: 근로자
  부담분 네 금액은 실제로 `employmentBusinessRateTier`(사업장 규모, 사업주 부담에만
  영향)에 의존하지 않는다 — 코드를 직접 읽어 확인했다. 통째로 호출하면 annual-salary-
  take-home-pay가 자신의 결과에 아무 영향도 주지 않는 값(사업장 규모, 보험별 가입
  on/off)을 타입을 맞추기 위해서만 채워 넣어야 하고, `four-major-insurance`가 향후 사업주
  부담 관련 개념으로 입력 타입에 새 필수 필드를 추가하면 기능적으로 무관한 이 계산기도
  함께 깨진다 — "값은 안 쓰지만 타입 때문에 강제로 결합되는" 나쁜 결합이다. 근로자
  부담분만 별도 함수로 분리하면 이 계산기는 사업장 규모·가입 on/off라는 개념 자체를
  한 번도 언급하지 않아도 된다.
- **왜 독립 재구현(복붙)을 하지 않았는가**: 위 "날짜 계산 유틸 공용화"와 같은 이유 —
  같은 법정 산식(국민연금법·국민건강보험법·고용보험법)을 두 파일에 복붙하면 한쪽만
  수정되는 드리프트 위험이 생긴다.
- **회귀 위험 관리**: `four-major-insurance`는 이미 PASS·published 상태다. 위 "날짜 계산
  유틸 공용화"가 세운 절차(함수 본문을 그대로 이동해 로직을 바꾸지 않음, 기존 공개
  시그니처 `calculateFourMajorInsurance(input): FourMajorInsuranceResult`를 그대로 유지하는
  얇은 wrapper로 감쌈, 이동 직후 기존 Golden Test 전체 재실행으로 회귀 없음을 확인)를
  금액 계산에도 동일하게 적용한다.
- **판단 기준 일반화**: "두 계산기가 동일한 법적 정의를 공유하는 순수 계산"이면 도메인이
  날짜든 금액이든 `src/lib/`로 추출한다. 다만 계산기 하나의 공개 API(가입 여부, 사업장
  규모처럼 그 계산기만의 정책적 개념이 섞인 함수) 전체를 추출 대상으로 삼지 않는다 —
  여러 계산기가 실제로 공유하는 **최소한의 순수 계산 단위**만 골라 추출한다(이번 사례는
  "근로자 부담분"이라는 부분집합만 추출하고 사업주 부담·가입 on/off는 `four-major-
  insurance`에 남긴 것이 이 원칙의 적용이다).
- 상세: `tasks/annual-salary-take-home-pay/ARCHITECTURE.md` "1. 핵심 결정 — 4대 보험
  근로자 부담분 재사용 방식".

## 무작위(RNG)를 쓰는 계산 로직 설계 패턴

### 결정 사례: RNG 주입 인터페이스와 "결정-재구성 분리" — bill-split-calculator (2026-09-07)

이 사이트 최초로 RNG(무작위)를 쓰는 계산기다. "계산 정확성"이 법령 대조가 아니라 편향 없는
확률/분포로 재정의되는 첫 사례이기도 하다(`tasks/bill-split-calculator/FORMULA.md` 참고).
앞으로 유사한 계산기(추첨·랜덤 배정류)가 또 생기면 아래 두 패턴을 그대로 따른다.

- **RNG 주입 시그니처를 고정한다**: `type RandomSource = () => number`(`[0,1)` 구간,
  기본값 `Math.random`)를 인자로 받는 순수 함수로 무작위 로직을 구현한다
  (`pickWinnerIndex(n, rng?)`, `fisherYatesShuffle(items, rng?)`). 이렇게 하면 (1) 고정
  시퀀스를 주입하는 결정적 단위 테스트와 (2) 실제 `Math.random`을 주입한 대량 통계
  시뮬레이션(Calculation Auditor)을 같은 함수로 모두 수행할 수 있다 — 이 시그니처는 Builder가
  임의로 바꾸지 않는다(Auditor 테스트가 그대로 이 시그니처에 의존한다).
- **"RNG로 값을 결정하는 단계"와 "이미 결정된 값으로 결과를 조립하는 단계"를 반드시 별도
  함수로 나눈다.** 예: `calculateWinnerTakeAll`(RNG 호출 1회 + 조립)을 `pickWinnerIndex`(RNG
  전담)와 `buildWinnerTakeAllShares`(RNG 없이 순수 조립)로 쪼갠다. 이렇게 분리해야 "결과를
  URL에 인코딩해 공유 복원할 때 RNG를 다시 호출하지 않고 동일한 결과를 재구성"할 수 있다
  (`tasks/bill-split-calculator/ARCHITECTURE.md` "6. ShareActions 인코딩 스키마" 참고) —
  조립 로직이 계산 로직에 섞여 있으면 복원 시에도 전체 함수를 다시 호출해야 해서 재현
  불가능한 다른 결과가 나올 위험이 생긴다.
- **연출용 장식적 무작위(애니메이션의 회전 바퀴 수, 사다리 가로줄 위치 등)는 이 RNG
  주입/검증 대상이 아니다** — 결과(`selectedIndex`/`permutation`)에 전혀 영향을 주지 않는
  순수 시각 효과이므로 통계 검증에서 제외해도 된다. 이 구분을 명시하지 않으면 Auditor가
  검증 범위를 오인할 수 있다.
- 상세: `tasks/bill-split-calculator/ARCHITECTURE.md` "2. 로직 폴더 구조 및 RNG 주입
  인터페이스".

## 클라이언트 측 이미지 저장(다운로드)

### 결정 사례: `html-to-image` 채택 — bill-split-calculator (2026-09-07)

이 사이트 최초로 "결과 화면을 이미지 파일로 다운로드"하는 기능이 필요해지면서 첫 이미지
변환 라이브러리를 도입했다. 후보였던 `html2canvas`/`html-to-image`/`dom-to-image` 중
`html-to-image`를 채택했다(`npm install`로 `package.json`에 실제 반영, `dependencies`).

- **`dom-to-image`는 제외**: `npm view`로 확인한 마지막 배포일이 2022-06-15로 4년 이상
  정체돼 있어 "유지보수 활발한지" 기준을 만족하지 못한다.
- **`html2canvas`(자체 렌더링 엔진, DOM을 직접 파싱해 캔버스에 재구현) 대신 `html-to-image`
  (DOM 클론 + `getComputedStyle` 인라인 + SVG `foreignObject`로 직렬화해 브라우저 자신의
  렌더링 엔진에 맡기는 방식)를 선택**했다. 판단 기준:
  - **다크모드(CSS 커스텀 프로퍼티) 정확도**: 이 사이트는 다크모드를 `.dark` 클래스 +
    CSS 커스텀 프로퍼티(`app/globals.css`)로 구현한다. 캡처 시점에는 브라우저가 이미 모든
    `var(--foo)` 참조를 구체값으로 해석한 뒤이므로, "브라우저의 `getComputedStyle` 결과를
    그대로 옮기는" `html-to-image` 쪽이 자체 스타일 해석 레이어를 거치는 `html2canvas`보다
    구조적으로 더 안전하다.
  - **번들 크기/의존성**: `html-to-image`는 런타임 의존성 0개, unpacked 315KB로
    `html2canvas`(의존성 2개, unpacked 3.38MB)의 약 1/10이다.
  - 이 사이트의 아이콘 관례(외부 `<img>` 없이 전부 인라인 `<svg>`, 폰트도 `next/font` 자체
    호스팅)가 `foreignObject` 방식의 가장 흔한 약점(이미지/폰트 CORS 문제)을 원천적으로
    없앤다.
- **사용 패턴**: 버튼 클릭 핸들러 안에서 동적 `import()`로 지연 로드해 메인 번들에 포함하지
  않는다. 캡처 대상은 애니메이션이 끝난 뒤의 정적 결과 카드 컨테이너로 한정한다(애니메이션
  진행 중 상태를 캡처하지 않도록 화면 구성 순서 자체가 이를 보장하게 설계).
- **알려진 리스크**: 구형 WebKit(오래된 iOS Safari)에서 `foreignObject`→canvas 변환이
  실패하는 사례가 보고돼 있다 — 모바일 대응이 필수인 이 사이트 특성상 QA 단계에서 iOS
  Safari 실기기 확인이 필요하다. 실패 시 대체 경로(에러 처리 → 텍스트 요약 공유)를 함께
  마련해 둔다.
- **향후 다른 계산기가 이미지 저장이 필요해지면 이 라이브러리를 그대로 재사용한다** —
  다크모드 CSS 커스텀 프로퍼티를 쓰는 한 이 판단 근거는 계산기가 달라져도 바뀌지 않는다.
- 상세: `tasks/bill-split-calculator/ARCHITECTURE.md` "4. 이미지 저장 라이브러리 선택".

## 결과 확정 후 연출(애니메이션) 컴포넌트

### 결정 사례: SVG + CSS, Canvas 배제, 계산기 전용 폴더 유지 — bill-split-calculator (2026-09-07)

이 사이트 최초로 "계산 결과를 먼저 확정한 뒤 그 결과를 보여주는 애니메이션을 재생"하는
계산기다(룰렛, 사다리타기). 다음 두 결정을 앞으로의 유사 사례에 적용한다.

- **렌더링 기술은 SVG + CSS 트랜지션/키프레임을 쓰고, `<canvas>` 기반 명령형 렌더링은
  쓰지 않는다.** 이유: (1) 다크모드 CSS 커스텀 프로퍼티/Tailwind 토큰 클래스를 그대로 써도
  `.dark` 토글에 자동으로 반응한다(Canvas는 매 프레임 `getComputedStyle`로 색상을 수동
  재계산해야 함), (2) `prefers-reduced-motion`을 CSS `@media`로 선언적으로 끌 수 있다(Canvas는
  애니메이션 루프 안에 수동 분기 필요), (3) 이미지 캡처 라이브러리(`html-to-image`)가 DOM
  요소를 특별한 처리 없이 그대로 캡처한다(`<canvas>`는 별도 취급 경로를 거친다).
- **결과가 확정된 이후에만 애니메이션 컴포넌트가 목표 상태를 받는다** — 애니메이션
  컴포넌트는 RNG 관련 인자를 아예 받지 않고, 이미 계산된 결과 필드(`selectedIndex`,
  `permutation` 등)만 props로 받아 "그 결과로 가는 시각적 경로"만 그린다. `playAnimation`
  플래그(및 `prefers-reduced-motion` 판단)는 애니메이션 컴포넌트 내부가 아니라 오케스트레이터
  (`ui.tsx`)가 한 곳에서 계산해 내려준다 — 판단 지점을 하나로 모아야 "애니메이션 유무와
  무관하게 결과가 같다"는 불변식을 테스트하기도 쉽다.
- **아직 이 패턴이 필요한 계산기가 하나뿐이라 `components/calculator/`로 승격하지 않는다**
  (housing-subscription-score/loan-interest-calculator가 세운 "아직 사례 1~2개뿐이면
  승격하지 않는다" 원칙과 동일) — 계산기 전용 폴더(`src/calculators/{slug}/`) 안에 별도
  파일로만 분리해 둔다. 두 번째 계산기가 이런 "결과 확정 → 연출" 애니메이션을 필요로 하는
  시점에 공용화를 재검토한다.
- 상세: `tasks/bill-split-calculator/ARCHITECTURE.md` "5. 애니메이션 컴포넌트 구조".

## 개인정보/데이터 처리
급여, 세금 등 사용자가 입력하는 값은 서버로 전송하거나 저장하지 않고 클라이언트에서만 계산한다. 서버 저장이 필요한 기능은 사전 논의 후 진행한다.

**예외(2026-09-13, 사용자 직접 요청)**: 네이버 애널리틱스(웹로그 분석, `//wcs.pstatic.net/wcslog.js`)를 `app/layout.tsx`에 전역으로 추가했다 — 이는 계산기 입력값과 무관한 방문 통계(어떤 페이지를 봤는지)만 네이버 서버로 전송하며, 계산기 로직 자체는 여전히 서버·외부 통신이 전혀 없다. 이 추가에 맞춰 `app/privacy/page.tsx`("2. 자동으로 수집되는 정보", "4. 제3자 제공 및 위탁")를 동시에 갱신했다 — 분석 도구를 새로 추가하면서 "분석 도구를 쓰지 않는다"고 적힌 개인정보처리방침을 그대로 두면 실제 상태와 문서가 어긋나므로, 이런 종류의 추가는 항상 `/privacy` 갱신과 함께 다뤄야 한다.

## SEO / 사이트맵
계산기 레지스트리를 단일 진실 공급원(SSOT)으로 삼는다.
1. `/src/calculators/registry.ts`에 모든 계산기를 등록한다 (slug, title, description, category, lastModified, status: published/draft).
2. `app/sitemap.ts`, `app/robots.ts`는 레지스트리를 순회해 자동 생성한다. sitemap.xml을 손으로 편집하지 않는다.
3. 각 페이지 `generateMetadata`는 레지스트리 값 기반, canonical URL 고정(쿼리스트링 상태와 무관).
4. 계산기 페이지에 JSON-LD(WebApplication/FAQPage) 삽입.
5. 홈/카테고리 목록도 레지스트리에서 동적 생성해 내부링크가 자동으로 확장되게 한다.
6. 페이지 구조: 계산기 → 결과 → 사용 방법 → 공식 → 예제 → FAQ.
7. Search Console 재제출/색인 요청은 수동 진행.
8. 네이버 서치어드바이저 사이트 소유 확인은 `app/layout.tsx`의 `metadata.verification.other["naver-site-verification"]`로 관리한다(하드코딩된 `<meta>` 태그를 별도로 두지 않는다 — Next.js Metadata API가 렌더링).

### 결정 사례: 카테고리 전용 페이지 신설 및 헤더 메뉴 (2026-09-13)
사용자가 홈 화면 카테고리 분류와 계산기 상세 페이지의 말머리(eyebrow) 표기가 서로 어긋나
있다는 것을 지적했다(예: `military-salary`는 `category: finance`인데 말머리는 "군 복무 ·
급여"). 전수 조사 결과 17개 계산기 중 13개가 `registry.ts`의 `categoryLabels`를 그대로
쓰지 않고 각자 임의의 부제를 붙이거나(예: "노동 · 근로", "날짜 · 생활") 카테고리 자체를
빠뜨리고 있었다 — 전부 `categoryLabels[category]` 값 그대로로 통일했다(자세한 규칙은
docs/DESIGN_SYSTEM.md "헤더(eyebrow) 라벨" 참고).

같은 작업의 연장으로 `/categories/[category]` 페이지를 신설했다:
- `app/categories/[category]/page.tsx` — `getPublishedCalculatorsByCategory(category)`로
  해당 카테고리의 공개 계산기만 카드 그리드로 나열한다. 공개 계산기가 0개인 카테고리는
  `generateStaticParams()`에서 제외되고 직접 URL 접근 시 404 처리한다(홈페이지가 빈 카테고리
  섹션을 렌더링하지 않는 것과 동일한 원칙).
- `app/sitemap.ts`에 카테고리 페이지 URL을 추가했다(공개 계산기가 있는 카테고리만).
- 헤더에 `components/calculator/CategoryNav.tsx`(신규)를 추가했다 — 기존에는 로고가 홈으로
  가는 링크 역할만 하고 실질적 메뉴 기능이 없었다. 네이티브 `<details>/<summary>`로
  구현해 클라이언트 상태(useState) 없이 카테고리 드롭다운을 제공한다(ThemeToggle 외에는
  헤더에 클라이언트 JS를 두지 않던 기존 관례와 일관). 320px에서 로고+메뉴+테마토글이 한 줄에
  들어가야 해서 좁은 화면에서는 아이콘만, `sm` 이상에서 "카테고리" 텍스트를 덧붙인다.

### 결정 사례: 사이트명 "계산기 모음" → "셈터" 변경, 로고 아이콘 교체, 정보 페이지 4종 신설 (2026-09-13)
사용자가 "계산기 모음"이라는 사이트명이 정체성이 약하다고 판단해 "셈터"(셈+터)로
바꿔달라고 요청했다. 다음을 변경했다.
- `app/layout.tsx`의 `metadata.title.default`/`template`, 헤더 로고 텍스트, `WebSite`
  JSON-LD(`name`), 푸터 저작권 표기를 전부 "셈터"로 통일했다. `metadataBase`를
  새로 지정하고(`siteUrl` 기반, 상대 OG 이미지 URL 해석에 필요), `openGraph`/`twitter`
  메타데이터를 처음으로 추가했다(이전에는 소셜 공유 미리보기 태그 자체가 없었다).
  `app/categories/[category]/page.tsx`의 페이지 타이틀도 "{라벨} 계산기 모음"에서
  "{라벨} 계산기"로 바꿔 옛 사이트명과 겹치는 표현을 없앴다.
- 헤더 로고 아이콘을 텍스트 문자 `=`(가로선 두 개라 `CategoryNav`의 햄버거 아이콘과
  혼동된다는 지적)에서 계산기 모양 인라인 SVG(테두리 사각형 + 화면 바 + 버튼 점 6개)로
  교체했다 — 새 카테고리 메뉴 아이콘과 시각적으로 구분되면서 "계산기 서비스"라는 정체성이
  더 잘 드러난다.
- `app/about`(서비스 소개), `app/contact`(문의하기, 이메일 `isnanik@daum.net`),
  `app/privacy`(개인정보처리방침), `app/terms`(이용약관) 4개 정적 페이지를 신설했다.
  계산기 레지스트리 대상이 아니므로 `app/sitemap.ts`에 고정 경로로 직접 추가했다(레지스트리
  기반 자동 생성 규칙과 별개). 개인정보처리방침은 실제 코드 상태(분석 도구·쿠키 없음,
  계산은 전부 클라이언트에서 처리)를 그대로 반영해 작성했고, 향후 분석 도구 등 실제 처리
  방식이 바뀌면 이 문서도 함께 갱신해야 한다. 이 두 문서는 일반적인 템플릿 수준으로
  작성됐으므로, 실제 서비스 운영 목적으로 법적 효력을 확정하려면 별도 검토를 권장한다.
