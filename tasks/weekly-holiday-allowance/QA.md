# QA: 주휴수당 계산기

2026-09-04. Calculation Auditor PASS · UX/UI Critic PASS(Medium 2 / Low 7) 이후 QA 단계.
Edit 권한이 없어 코드는 수정하지 않았다. Bash는 빌드/타입체크/서버확인/모듈 격리 실행 용도로만,
Write는 이 문서 작성에만 사용했다. 이미 Auditor·Critic이 보고한 이슈는 중복 등급을 매기지 않고
참조만 한다.

---

## 환경 / 실행 결과

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | **PASS** — 오류 0 (직접 실행) |
| `npx eslint src/calculators/weekly-holiday-allowance/` | **PASS** — 경고/오류 0 (직접 실행) |
| `npm run build` (next build, Turbopack) | **PASS** — "Compiled successfully", TypeScript 통과, 정적 페이지 8/8 생성. 빌드 로그 warning 0. `/calculators/weekly-holiday-allowance`는 프리렌더 목록·sitemap에 **없음**(status `draft` → 정상). severance-pay / unemployment-benefit 두 페이지는 SSG로 그대로 생성됨(회귀 없음). |
| `npm test` / `./node_modules/.bin/vitest run` | **실행 불가** — 아래 참고. 계산기 코드와 무관한 환경 이슈. |
| 로컬 프로덕션 서버 `http://localhost:3000` | 구동 중. `/calculators/weekly-holiday-allowance` → **HTTP 200** (36,114 bytes), `/` · `/calculators/severance-pay` · `/calculators/unemployment-benefit` 전부 **200**. |
| 서버 콘솔(SSR) | 페이지 요청 전후 에러/경고/스택트레이스 없음. |
| 브라우저(Playwright 등) | **없음** — 실제 뷰포트 렌더링·브라우저 콘솔·실측 WCAG 명도대비는 이번에도 수행 불가. 코드/마크업 정적 분석 + SSR HTML 파싱 + 실제 모듈 격리 실행으로 대체(이전 QA 라운드와 동일한 구조적 제약). |

### vitest 스위트를 이 세션에서 실행하지 못함 (환경 이슈, 계산기 결함 아님)

- `npm test`, `./node_modules/.bin/vitest run`, `--no-file-parallelism`, `--pool=forks`,
  단일 파일 실행, 무-플러그인 커스텀 config — **전부 동일하게** 테스트 수집 단계에서
  `TypeError: Cannot read properties of undefined (reading 'config')`로 12개 파일 전원 크래시
  (`no tests`). scratchpad에 만든 **trivial 테스트**(`expect(1+1).toBe(2)` 하나)도 같은 지점에서
  죽는다 → 주휴수당 코드·테스트와 무관하다.
- 원인 추정: `vitest@4.1.11` 러너 + `vite@8.2.2`(`node_modules`/`package-lock.json` 모두 8.2.2) +
  Node 24.17.0 조합. `describe()` 첫 호출에서 러너 config가 undefined다. Architect가
  ARCHITECTURE.md "남은 리스크"에 적은 "샌드박스 병렬 실행 이슈"와는 증상이 다르며(그건
  `--no-file-parallelism`로 우회됐다고 함), 이번에는 그 우회도 통하지 않는다.
- **Calculation Auditor는 같은 날(2026-09-04) `npm test`로 150/150 통과를 보고**했다 —
  그 사이 환경이 바뀌었거나(Node/vite) 환경 의존적 문제다. → **인프라 항목으로 Optimizer에
  전달**(아래 이슈 표 INFRA-1). Optimizer가 `vitest.config.mts`에 `test.fileParallelism: false`를
  넣는 것만으로는 해결되지 않는다(이번엔 그 옵션도 무력).
- QA는 대신 `node --experimental-strip-types`로 **실제 `logic.ts` / `validation.ts` /
  `formatting.ts` 모듈을 격리 실행**(JSON import 경로만 수정한 사본, 소스 미변경)해
  Golden 7개 + 검증 27케이스 + 경고/breakdown 조립을 직접 검증했다. 아래 결과는 전부 이
  실제 모듈 실행 기준이다.

---

## 기능 테스트

### 핵심 계산 — FORMULA.md 검증 예제 (실제 `logic.ts` 격리 실행 + `roundWon` 적용)

| 예제 | 입력 | 1주치 주휴수당 | 월환산 주휴수당 | 포함 주급 | 포함 월급 | 실질시급 | 플래그 | 판정 |
|---|---|---|---|---|---|---|---|---|
| 1 | 10,320 / 40h | 82,560 | 358,743 | 495,360 | 2,152,457 | 12,384 | meets✓ below✗ capped✗ | ✅ FORMULA Expected 완전 일치 |
| 2 | 10,000 / 20h | 40,000 | 173,810 | 240,000 | 1,042,857 | 12,000 | below✓ | ✅ 일치 |
| 3 | 9,000 / 16h | 28,800 | 125,143 | 172,800 | 750,857 | 10,800 | below✓ | ✅ 일치 |
| 4 | 12,000 / 15h | 36,000 | 156,429 | 216,000 | 938,571 | 14,400 | meets✓(15 이상) | ✅ 일치 |
| 5 | 10,320 / 14h | 28,896 | 125,560 | 173,376 | 753,360 | 12,384 | **meets✗**(경고) below✗ | ✅ 일치, 게이팅 없이 계산 |
| 6 | 15,000 / 48h | 120,000 | 521,429 | 840,000 | 3,650,000 | 17,500 | **capped✓**(8h 상한) | ✅ 일치 |
| 7 | 11,000 / 13.5h | 29,700 | 129,054 | 178,200 | 774,321 | 13,200 | **meets✗**(소수 입력) | ✅ 일치 |

- 별도 재구현(rates-2026.json 상수만 읽고 FORMULA "공식" 직접 코딩)으로도 7개 전부 재현 →
  실제 모듈 결과와 이중 일치. Calculation Auditor의 4개 온라인 계산기 소스 대조 결과와도 정합.
- `weeklyHolidayHours`는 반올림 없이 소수 그대로(예제 3 = 3.2, 5 = 2.8, 7 = 2.7) 반환·표시됨 확인.
- 예제 5 부동소수점 드리프트(`2.8 × 10,320 = 28,895.9999…`)는 `roundWon`의 EPSILON 보정으로
  28,896원으로 올바르게 표시됨 확인(Auditor의 BigInt 전수 스캔 "오탐 0" 결과 인용).

### 화면 구성 (SSR HTML + 코드 확인)

- 공통 화면 순서 준수: 헤더 → 입력 폼 → (결과) → 계산 상세 → 계산 방법 → 적용된 입력값 →
  사용 방법 / 소개 → 정책 안내 → FAQ.
- **핵심 결과 카드**: `bg-primary` 채운 카드 1개 = "1주치 주휴수당". (b)월환산·(c)총급여·(d)실질시급은
  전부 "계산 상세" `SectionCard`로 내려감 → SPEC "핵심 카드 하나" 준수.
- **경고 카드 2종**(독립 조건): `!meetsMinHoursRequirement` → "주 15시간 미만 …" / `belowMinimumWage`
  → "입력한 시급이 2026년 최저임금보다 낮습니다"(+ 수습 감액 보조 문구). 동시 노출 가능
  (입력 9,000/10h로 실제 모듈에서 두 문구 다 조립됨 확인).
- **40시간 초과 고지**: `cappedAtStatutoryLimit` 시 "계산 상세" 하단에 `STATUTORY_LIMIT_NOTICE`
  ("주 40시간을 초과한 시간은 … 주휴수당 산정에 포함되지 않습니다 … 연장근로 가산수당은 …
  계산하지 않습니다") 노출. 정확히 40h면 미노출(경계 정상).
- **월 환산 "참고액" 라벨 + 주석**: "계산 상세"에 `(참고액)` 표기 + `MONTHLY_REFERENCE_NOTE`
  (209시간 관례 차이 고지) 항상 노출.
- **적용된 입력값 카드**: 시급 / 주 근무시간 2값 재표시(용어 "시급"·"주 근무시간"으로 폼과 통일).
- **breakdown "계산 방법"**: 6행, 각 행 `label` + `근거: {법령}` + `라벨 = 값` 수식. 서술형
  내레이션·반올림 설명 없음 — unemployment-benefit v2 스타일 준수.
- **정책 고지(항상 노출)**: 15시간 이상·개근 요건, 근로기준법 제55조제1항·시행령 제30조제1항·
  제18조제3항, 통상근로자 주 40시간·주 5일 전제, 제63조 적용제외, 기준 연도(2026) + "매년 갱신"
  문구 전부 정책 안내 섹션에 존재.
- **JSON-LD**: `WebApplication` + `FAQPage`(질문 6개) 두 블록이 SSR HTML에 정상 출력.
  FaqAccordion도 같은 6개 질문(seo-content.ts SSOT) 렌더링.
- draft 상태라 `generateMetadata`가 `{}` 반환 → 페이지 `<title>`/meta description/canonical이
  사이트 기본값. published 전환 시 `calculator.title`/`description`/canonical이 정상 생성되도록
  배선돼 있음(코드 확인). **draft 단계에서는 정상**(sitemap·홈 미노출).

---

## 입력 검증 (실제 `validation.ts` 격리 실행, 27케이스)

| 구분 | 케이스 | 결과 | 판정 |
|---|---|---|---|
| 빈 입력 | 둘 다 빈값 | 두 필드 오류 반환 | ✅ |
| 빈 입력 | 시급만 빈값 / 주시간만 빈값 | 해당 필드만 "…을(를) 입력해 주세요." | ✅ |
| 공백 | 시급 `"   "` | trim 후 "시급을 입력해 주세요." (Number 조용한 0 둔갑 방지) | ✅ |
| 0 | 시급 `0` / 주시간 `0` | "…은(는) 0보다 커야 합니다." | ✅ |
| 음수 | 시급 `-5000` / 주시간 `-10` | "…은(는) 0보다 커야 합니다." | ✅ |
| 소수(시급) | `10320.5` (직접/붙여넣기 경로) | "시급은 정수로 입력해 주세요." | ✅ (단 UI 경로는 아래 L2) |
| 소수(주시간) | `13.5` / `13.3` (0.5 배수 아님) | 통과, `weeklyHours` 그대로 | ✅ 소수 허용 |
| 잘못된 문자 | 시급 `"abc"` / 주시간 `"풀타임"` / `"20abc"` | "…은(는) 숫자로 입력해 주세요." | ✅ |
| 잘못된 문자 | 주시간 `"Infinity"` | "숫자로 입력해 주세요." (`Number.isFinite` 처리) | ✅ |
| 매우 큰 값 | 시급 `1,000,001` | "시급은 1,000,000 이하로 입력해 주세요." | ✅ |
| 매우 큰 값 | 시급 `1,000,000` (경계) | 통과 | ✅ |
| 매우 큰 값 | 주시간 `168.5` / `1000` | "주 근무시간은 168 이하로 입력해 주세요." | ✅ |
| 매우 큰 값 | 주시간 `168` (경계) | 통과 | ✅ |
| 천단위 콤마 | 시급 `"10,320"` / `"12,500원"` | 콤마·"원" 제거 후 파싱 → 통과 | ✅ |
| 경계값 | 주 15 / 14.99 / 15.01 | 전부 검증 통과(오류 아님). `meetsMinHoursRequirement`는 각각 true/false/true | ✅ |
| 경계값 | 주 40 / 40 초과 | 전부 통과(오류 아님). logic이 8h 상한 처리 | ✅ |
| 최저임금 | 시급 10,320(정확히) / 10,319(미만) / 9,000 | 전부 통과. `belowMinimumWage` = false/true/true | ✅ |
| 게이팅 없음 | 15 미만·40 초과·최저임금 미만 | **오류로 막지 않음** — SPEC "설계상 핵심 결정" 준수 | ✅ |

- 한글 조사 처리: `particle()` 헬퍼로 "시급을"/"시급은", "주 근무시간을"/"주 근무시간은" 정확.
- `hourlyWage`는 정수 강제, `weeklyHours`는 소수 허용(0.5 배수 강제 안 함) — ARCHITECTURE.md
  "입력 필드 설계"와 일치.

---

## Reset / Sample

- **초기화(`handleReset`)**: `setForm(EMPTY_FORM)` + `setErrors([])` + `setResult(null)` +
  `setAppliedInput(null)` — 입력·오류·결과·적용입력값 4가지를 모두 비운다. 코드 확인 완료
  (severance-pay와 동일 패턴). `ui.test.tsx`가 초기화 후 시급 필드 빈값 + "1주치 주휴수당"
  heading 사라짐을 검증(테스트 코드 확인 — 이 세션에서 실행은 못 했으나 로직상 통과).
- **샘플 값 채우기(`handleFillSample`)**: `SAMPLE_FORM = { hourlyWage: "10,320", weeklyHours: "40" }`
  (FORMULA.md 예제 1). 오류·결과·적용입력값은 함께 비워지므로 사용자가 "주휴수당 계산하기"를
  눌러야 결과가 뜬다(다른 계산기와 동일). 그 결과 = 1주치 주휴수당 **82,560원** = FORMULA
  예제 1 Expected와 일치(실제 모듈로 재확인). 두 경고 모두 미노출(10,320 = 최저임금, 40h ≥ 15h)
  → 첫인상 깔끔.
- Copy(결과 복사) 기능은 SPEC·DESIGN_SYSTEM에 요구사항 없고 미구현 — 해당 없음(결함 아님).

---

## 모바일 / 반응형 (코드/마크업 정적 분석 — 실제 뷰포트 렌더링 불가)

| 폭 | 분석 |
|---|---|
| 320 / 375 / 390px | 모든 그리드가 base 1열(`grid-cols-1`, `lg:grid-cols-2`는 미적용). 컨테이너 `px-5`, 폼 `p-5`, 입력 `w-full`. 핵심 카드 금액 `text-4xl` + `tabular-nums` + `tracking-[-0.04em]` — 현실적 최대값("800,000원" 수준)은 320px 콘텐츠폭(≈232px)에 수용. breakdown 수식은 일반 `<p>`(줄바꿈 허용, `whitespace-nowrap`/`<pre>` 없음). 버튼 `flex flex-wrap gap-3` → 좁은 화면에서 2줄 줄바꿈. 터치 타깃 `py-3`(≈44px). |
| 768px | 결과 `dl`이 `sm:grid-cols-2`(2열)로 전환, `sm:px-8`/`sm:p-8`. 사용안내·소개는 아직 세로 적층(`lg:` 미도달). |
| 1440px | `max-w-6xl`(1152px) 중앙 정렬, 사용안내·소개 2열. |
| 공통 | SSR HTML에 `overflow-x` 0건, `w-[…px]`/`min-w-[…px]` 고정폭 0건 → 가로 스크롤 유발 요소 없음. `inputMode` = 시급 `numeric` / 주시간 `decimal` → 모바일 숫자 키패드. 경고 카드 2종 동시 노출 시 세로로 쌓임(레이아웃 붕괴 없음). |

- 폼 헤더 `flex items-center justify-between`("계산 정보 입력" + 긴 부제 + "필수 2개" 배지,
  배지에 `shrink-0` 없음)는 severance-pay·unemployment-benefit과 **동일 패턴**이며 그쪽이 QA를
  통과한 수준이다. 실제 320px에서 배지 눌림 여부는 브라우저 확인이 필요하나, 부제가 wrap되며
  배지가 밀리는 정도로 Critical/High는 아니다.
- **Mobile Critical Issue: 0** (구조 기준). 실측 확인 불가는 명시.

---

## 접근성 (SSR HTML 직접 파싱 + 컴포넌트 코드 확인)

| 항목 | 결과 |
|---|---|
| label ↔ input 연결 | `<label for="…-hourlyWage">` / `<label for="…-weeklyHours">` ↔ `<input id="…">` **2:2 1:1 매칭**(React `useId` 접두사). |
| 필수 표시 | 라벨에 빨간 `*`(`aria-hidden`) + `<input aria-required="true">` 2개. 색상 단독 아님. |
| 오류 접근성 | `<p role="alert" id="…-error">` + input `aria-invalid` + `aria-describedby="…-error …-help"` (코드 확인, 초기 SSR엔 오류 없어 `role=alert` 0건 — 정상). |
| helpText 연결 | 두 input 모두 `aria-describedby="…-help"` 상시 연결. |
| 결과 영역 | `<div aria-live="polite">`로 결과+경고+breakdown 전체를 감쌈 (SSR HTML에 1건). 갱신 시 스크린리더 인지. |
| 조건부 토글 안내 | 이 계산기엔 체크박스/토글 입력이 **없음** → DESIGN_SYSTEM "토글 조건부 안내도 aria-live" 항목 해당 없음. |
| FAQ 아코디언 | 네이티브 `<button>` 6개, `aria-expanded` + `aria-controls`, 패널 `role="region"` + `aria-labelledby`. 키보드 조작 가능, 아이콘 회전 + `aria-expanded` 병행(색상 단독 아님). |
| 포커스 | 전역 `:focus-visible` 사용, 컴포넌트에서 outline 제거 없음. |
| 다크모드 | 색상 전부 토큰(`bg-primary`, `border-warning-border`, `bg-warning-surface`, `text-muted` 등) + 필요 시 `dark:` 변형(zinc/amber). 사이트 테마 토글 존재(`aria-label="라이트/다크 모드 전환"`). |
| 명도대비 WCAG AA | **실측 불가**(브라우저 없음). 토큰 기반이라 이론상 AA 충족. 비토큰 색: 경고 카드 아이콘 `text-amber-800 dark:text-amber-300` — Critic L2(경고 카드 2종 시각 동일)와 같은 맥락, 별도 등급 안 매김. |
| 경고 카드 heading 레벨 | `<h3>` (Critic **L7**이 이미 `<h2>` 권고 — 재보고 안 함). 현재 문서 순서: h1 → h2(폼) → h2(핵심카드) → h3·h3(경고) → h2(계산상세)…. h2→h3는 레벨 스킵 아님. 의미상 형제 섹션이라는 Critic 지적에 동의. |

---

## Console Error / TypeScript Error

- **TypeScript Error: 0** — `tsc --noEmit` 직접 실행, 출력 없음.
- **Console Error: 0 (정적 분석 기준)** — 브라우저 콘솔 실측 불가. 근거: (1) `npm run build`
  로그 warning 0, (2) 서버(SSR) 콘솔 에러 0, (3) 컴포넌트에 `useEffect`·`window`·`Date.now()`·
  `Math.random()` 없음 → hydration mismatch 위험 없음(`APPLICABLE_RATE_YEAR`는 상수),
  (4) `.map` 렌더의 `key`가 전부 고유(`field.name` / `row.label` / `item.question` /
  `item.title` / index) → key 경고 없음, (5) `eslint` 0.

---

## 회귀 (severance-pay / unemployment-benefit)

- 이번 라운드는 순수 additive(새 폴더 + `rates-2026.json`에 `laborStandards` 최상위 키 추가 +
  `calculator-components.ts` / `page.tsx faqItemsBySlug` / `registry.ts` 항목 추가 +
  `CalculatorCard.tsx`에 `calendar` 아이콘 분기 추가). 기존 두 계산기 소스는 미변경.
- `npm run build`: severance-pay / unemployment-benefit 페이지 SSG 정상 생성.
- `curl`: 두 페이지 + 홈 전부 HTTP 200.
- Calculation Auditor가 같은 날 `npm test` 150/150(기존 + 주휴수당 신규) 통과 + 회귀 없음 보고.
  QA는 이 세션에서 스위트 재실행을 못 했으나(위 INFRA-1), 소스 미변경 + 빌드/타입/라우트
  정상으로 회귀 위험 신호 없음.

---

## 테스트 커버리지 갭 (코드는 못 고치니 지적만)

기존 스위트(logic.test.ts Golden 7 + Edge 7 + roundWon 3, validation.test.ts 27, ui.test.tsx 4)는
SPEC/FORMULA의 핵심·엣지를 잘 덮는다. 다만 아래 시나리오가 자동 테스트에 없다:

1. **UI 실시간 콤마 포맷터(`handleAmountChange`)의 비-숫자 제거 동작** — `validation.test.ts`는
   `validateWeeklyHolidayAllowanceInput`를 직접 호출하므로 "시급에 `10320.5`를 타이핑하면
   `handleAmountChange`가 `.`을 제거해 `103205`가 된다"는 UI 경로가 테스트되지 않는다
   (아래 L2). `ui.test.tsx`도 `fireEvent.change`로 최종 문자열만 주입해 이 변환을 안 탄다.
2. **`buildMinHoursWarning` / `buildBelowMinimumWageWarning` 문구 스냅샷** — 경고 카드가
   *뜨는지*는 `ui.test.tsx`가 확인하나, 조립된 **문구 내용**(조사·수치·법령)을 검증하는
   테스트가 없다. 아래 L1(조사 오류)이 테스트로 안 잡힌 이유.
3. **`buildWeeklyHolidayBreakdown` 6행의 label/expression/legalBasis 문자열** — 값 검증 테스트
   없음. Critic L3(수식의 맨숫자 의미)도 테스트 사각지대.
4. **`formatHours`의 소수 2자리 절단**(예: `weeklyHours=13.3` → `2.66시간`) — logic.test는
   `weeklyHolidayHours` 숫자값만 보고 표시 문자열은 안 본다.
5. **극단 조합의 표시 안정성** — `logic.test.ts`에 `1,000,000 / 168h` 케이스는 있으나
   `formatWon`/`formatHourlyWage`를 거친 최종 표시 문자열 길이·자릿수(모바일 레이아웃 영향)는
   테스트 밖.
6. **경고 카드 2종 동시 렌더 시 heading 개수/순서** — `ui.test.tsx`가 두 heading 존재는
   확인하나 문서 heading 레벨 순서(h2→h3→h3→h2)는 검증 안 함.

---

## 발견된 이슈 (등급별 — 신규만. Auditor/Critic 보고분은 참조)

### Critical: 0 · High: 0 · Medium: 0

### Low

| ID | 항목 | 내용 / 재현 |
|---|---|---|
| **L1** | 15시간 미만 경고 문구의 한국어 조사 오류 | `formatting.ts` `buildMinHoursWarning` 본문: `` `입력한 주 근무시간 ${formatHours(input.weeklyHours)}는 15시간 미만입니다.` `` → 실제 출력 **"입력한 주 근무시간 10시간는 15시간 미만입니다."**. `formatHours` 반환값은 항상 "…시간"(받침 ㄴ)으로 끝나므로 조사는 항상 **"은"**이어야 한다("10시간은"). 주 15시간 미만을 입력하는 **모든** 계산에서 경고 카드 첫 문장에 노출된다(게이팅 없는 이 계산기의 핵심 시나리오). 의미 전달에는 지장 없음 → Low. 재현: 시급 아무 값 + 주 근무시간 `10` → 계산 → "주 15시간 미만" 경고 카드 본문. `validation.ts`의 `particle()` 헬퍼를 재사용하거나 `입력한 주 근무시간(10시간)은 …`처럼 괄호로 감싸면 해결. |
| **L2** | 시급 소수점 입력 시 조용한 문자 제거로 값 왜곡 가능 | 시급 필드의 실시간 콤마 포맷터(`ui.tsx` `handleAmountChange`)가 `replace(/[^0-9]/g, "")`로 숫자 외 문자를 즉시 제거한다. 사용자가 `10320.5`를 입력하면 `.`이 지워지고 **`103,205`(의도의 10배)**로 표시되며, 오류·경고가 전혀 없다. `validation.ts`의 "시급은 정수로 입력해 주세요." 오류는 이 경로에서 **도달 불가**(직접 호출/붙여넣기 후에만). severance-pay·unemployment-benefit의 금액 필드와 **동일한 공유 패턴**이고, 시급을 소수로 입력하는 사용자는 드물어 실사용 위험은 낮다 → Low. 재현: 시급 필드에 `10320.5` 타이핑 → 필드값이 `103,205`가 됨. FORMULA/SPEC이 요구한 "시급 소수 → 거부"는 결과적으로 달성되나(소수 저장 안 됨), "거부(안내)"가 아니라 "왜곡(무안내)"이라는 점에서 갭. |
| **L3** | `toOptionalNumber`가 JS 숫자 리터럴 문자열을 강제 변환 | `Number("0x10")`=16, `Number("1e7")`=1e7 등 16진수·지수 표기 문자열이 "숫자로 입력해 주세요"로 거부되지 않고 `Number()`로 조용히 변환된다. 붙여넣기로 `0x10` → 시급 16으로 통과(정수·양수·상한 내라서). UI 경로에선 시급 필드가 `[^0-9]` 제거로 `010`→`10`이 되고, 주시간 필드는 `Number("1e3")`=1000 → "168 이하" 오류로는 걸린다. **기존 3개 계산기 공통 패턴**(severance-pay/unemployment-benefit `toOptionalNumber` 동일). 대상 사용자가 이런 문자열을 입력할 일이 거의 없어 정보성에 가까움 → Low. |

### 정보성 (등급 없음)

| ID | 항목 | 내용 |
|---|---|---|
| **INFRA-1** | vitest 스위트가 이 세션에서 실행 불가 | `vitest@4.1.11` + `vite@8.2.2`(lock에 고정) + Node 24.17 조합에서 러너가 테스트 수집 단계에 `Cannot read properties of undefined (reading 'config')`로 전 파일(trivial 포함) 크래시. `--no-file-parallelism`·`--pool=forks`·단일 파일·무플러그인 config 모두 무력. Calculation Auditor는 같은 날 150/150 통과 보고 → 환경 의존. **Optimizer/인프라**: `vite`를 `^7`로 다운핀하거나 `vitest`를 vite 8 호환 버전으로 올리는 등의 조치 필요. 계산기 코드 결함 아님. |
| INFO-1 | draft 페이지에 JSON-LD는 나오지만 메타데이터는 사이트 기본값 | `generateMetadata`는 non-published에 `{}` 반환(의도됨), 반면 default export의 JSON-LD는 status 무관하게 출력. draft라 sitemap·링크가 없어 크롤 경로가 없으므로 무해. published 전환 시 `<title>`/description/canonical 정상 생성되도록 이미 배선됨. 조치 불요. |
| INFO-2 | Critic M1/M2/L1~L7 미해결 | Critic이 Optimizer 처리 항목으로 넘긴 Medium 2 / Low 7(핵심 카드 조건부 인라인 고지, "실질 시급" 설명 한 줄, 209시간 주석 순화, 월환산 명칭 통일, 경고 카드 시각 차등화, 수식 맨숫자 주석, helpText 첫머리 일상어화, 오류 메시지 "원" 누락, 경고 카드 `h3`→`h2`). QA도 코드에서 전부 재확인함 — 등급 유지. QA 신규 L1은 Critic L1(명칭 흔들림)과 별개의 실제 문법 오류다. |

---

## docs/EVALUATION.md PASS 기준 대비

| 기준 | 결과 |
|---|---|
| Golden Test 100% PASS | ✅ 7/7 — 실제 `logic.ts` 격리 실행 + 독립 재구현 이중 검증, FORMULA Expected 완전 일치. Calculation Auditor의 4개 라이브 계산기 소스 대조도 정합. |
| Console Error 0 | ✅ (정적 분석 — 빌드 warning 0, SSR 콘솔 0, hydration 위험 요소 없음, key 경고 없음. 브라우저 콘솔 실측은 환경상 불가). |
| TypeScript Error 0 | ✅ `tsc --noEmit` 직접 실행, 오류 0. |
| Mobile Critical Issue 0 | ✅ (구조 분석 — 가로 스크롤 유발 요소 0, 고정폭 0, 1열 우선 그리드, 숫자 키패드, 참고 계산기와 동일 패턴. 실측 뷰포트는 불가). |
| Critical 0 / High 0 | ✅ QA 신규 Critical·High 0. Auditor·Critic도 0. |
| 계산 정확성 33/35+ | ✅ 상당(공식·상수 바인딩·반올림 정책 무결, Golden 100%, 게이팅 없음 설계 정확 구현). |

---

## 종합 판정

**PASS**

- 계산 정확성: FORMULA.md 검증 예제 7개 전부, 실제 `logic.ts` 모듈 격리 실행 + 독립 재구현으로
  이중 확인 — 완전 일치. 경계값(15 / 40 / 최저임금), 8시간 상한, 소수 시간, 부동소수점 드리프트
  전부 정상. 게이팅 없이 항상 계산 + 경고 플래그 설계(SPEC "설계상 핵심 결정") 정확히 구현.
- 입력 검증: 빈값 / 0 / 음수 / 소수(시급 거부·주시간 허용) / 잘못된 문자 / 매우 큰 값 / 천단위
  콤마 / 경계값 27케이스를 실제 `validation.ts`로 직접 실행 — 전부 기대대로. 15미만·40초과·
  최저임금미만을 오류로 막지 않음도 확인.
- Reset·Sample: 초기화가 입력·오류·결과·적용입력값을 모두 지움. 샘플(10,320/40h) → 82,560원
  (예제 1) 일치.
- 접근성: label/input 1:1, `role="alert"`+`aria-describedby`, 결과 `aria-live="polite"`, FAQ 키보드
  조작 가능, 토큰 기반 색상. 경고 카드 `h3`는 Critic L7로 이미 접수됨.
- TypeScript 0, ESLint 0, build 성공, 회귀 없음.
- 신규 이슈는 **Low 3건뿐**(경고 문구 조사 오류 / 시급 소수 조용한 왜곡 / `Number()` 강제 변환)
  으로 docs/EVALUATION.md PASS 기준(Critical 0 · High 0 · Golden 100% · Console/TS Error 0 ·
  Mobile Critical 0)을 막지 않는다.
- **제약**: 이 세션은 (1) 브라우저 부재로 실제 뷰포트·브라우저 콘솔·실측 명도대비를,
  (2) 환경 이슈(INFRA-1)로 `vitest` 스위트 자체를 실행하지 못했다. (2)는 실제 모듈 격리 실행으로,
  (1)은 SSR HTML 파싱 + 마크업 분석으로 대체했으며, 이 대체가 Critical/High를 놓쳤을 가능성은
  낮다고 판단하나 완전한 대체는 아님을 명시한다. 최종 배포(published 전환) 판정은 QA 범위 밖.

### Optimizer 처리 권고 순서

1. **INFRA-1** — `vitest`/`vite` 버전 정합(팀 CI·개발 흐름 차단 요소). 이후 스위트 재실행으로
   150+개 그린 재확인.
2. Critic **M1**(핵심 카드 조건부 인라인 고지) → **M2**("실질 시급" 설명 + 209시간 주석 순화).
3. **L1**(경고 문구 "…시간는" → "…시간은", `particle` 재사용) — 게이팅 없는 이 계산기에서
   자주 노출되는 문구라 M2와 함께 처리 권장.
4. Critic L1(월환산 명칭 통일)·L5(오류 메시지 "원"/"168" 근거)·L7(경고 카드 `h2`).
5. **L2**(시급 소수 입력 시 안내 없는 왜곡) — 최소한 소수점 입력 시 힌트/경고, 또는
   붙여넣기 방어. 3개 계산기 공통 패턴이므로 범위·우선순위는 Optimizer 판단.
6. Critic L2·L3·L4·L6, QA L3(정보성).
