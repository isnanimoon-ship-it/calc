# QA: 퇴직금 계산기

## 환경 / 서버 구동 결과
- `npm run dev:webpack -p 3001`을 25초 타임아웃으로 실행 — 정상 기동 확인(`✓ Ready in 315ms`, 문서화된 Turbopack dev 패닉 이슈는 webpack 모드에서는 재현되지 않음). 타임아웃으로 강제 종료했을 뿐 실패는 아님(EXIT=124는 `timeout` 명령 자체의 종료 코드).
- 실제 QA는 `npm run build && npm run start`(프로덕션 서버, port 3000)로 진행 — 정상 기동(`✓ Ready in 105ms`).
- `curl http://localhost:3000/calculators/severance-pay` → **HTTP 200**, HTML 17,759바이트 정상 응답 확인(홈에는 draft라 노출되지 않지만 직접 URL 접근 가능함을 재확인).
- `curl http://localhost:3000/` → HTTP 200 (홈페이지도 정상, 회귀 없음).
- 서버 콘솔 로그(`npm run start` stdout)를 페이지 요청 전후로 확인 — 에러/경고 없음.
- **브라우저 없음**: `npx playwright`로 확인한 결과 프로젝트에 Playwright가 devDependency로 설치되어 있지 않고, 캐시된 브라우저 바이너리(`ms-playwright` 디렉터리)도 없음. 실제 렌더링된 모바일 뷰포트 스크린샷, 실제 브라우저 콘솔 에러, 실측 명도 대비(WCAG AA) 확인은 **수행하지 못했다** — 아래 해당 항목은 정직하게 "코드/마크업 정적 분석으로 대체 검증"으로 표시한다.

## 기능 테스트
- `npm test` (vitest run): **PASS** — 3 test files, **39/39 통과** (logic.test.ts 25건 — Golden Test 7개 포함, validation.test.ts 14건).
- `npx tsc --noEmit`: **PASS** — 출력 없음(타입 에러 0건).
- `npm run build` (Next.js 16.3.4, Turbopack): **PASS** — "Compiled successfully", 정적 페이지 생성 정상(`/`, `/calculators/[slug]` 등), 빌드 로그에 warning 없음.
- `npx eslint .`: **PASS** — exit code 0, 출력 없음(lint 에러/경고 0건).

## 입력 검증 (validation.ts를 tsx로 직접 실행해 검증 — 테스트 코드 존재 여부가 아니라 실제 호출 결과로 확인)
`npx tsx`로 `validateSeverancePayInput`을 29개 케이스에 대해 직접 호출한 결과, **전 케이스가 기대대로 동작함(29/29 일치)**:

- **빈 입력**: 전체 빈값 → 4개 필드 오류 모두 반환. hireDate만 빈값 → 해당 필드만 오류. wage3m=undefined → 오류. 공백만 입력(`"   "`) → trim 후 빈값으로 처리되어 오류. 모두 차단 확인.
- **음수**: wage3m=-1, weeklyScheduledHours=-5, bonus12m=-1000(선택 입력도 포함), ordinaryDailyWage=-1 → 전부 "0 이상이어야 합니다" 오류로 차단 확인.
- **0**: wage3m=0, weeklyScheduledHours=0(지급요건 미충족 여부는 logic.ts가 별도 판정 — validation 단계는 통과가 맞음), bonus12m/annualLeavePay12m/ordinaryDailyWage=0 → 전부 정상 통과 확인(FORMULA.md 예외 절과 일치).
- **매우 큰 값**: wage3m=1,000,000,000,000,000(1천조원) → 통과(금액 필드는 상한 미설정, 아래 이슈 참고). weeklyScheduledHours=168(상한 경계) → 통과, 169(경계 초과) → 차단. wage3m="Infinity"/"NaN" 문자열 → "숫자여야 합니다" 오류로 차단 확인.
- **소수**: wage3m=9200000.5 → "정수여야 합니다" 오류로 차단. bonus12m=1000.5(선택 입력) → 동일하게 차단. weeklyScheduledHours=14.5 → FORMULA.md대로 소수 허용, 정상 통과.
- **잘못된 문자**: wage3m="abc" → 차단. hireDate="입사일임"(한글 문자열), hireDate="2024/01/01"(구분자 오류), retireDate="2024-02-30"(존재하지 않는 날짜), retireDate="2024-13-01"(월 범위 초과), weeklyScheduledHours="사십시간" → 전부 형식/숫자 오류로 차단 확인. `wage3m="<script>alert(1)</script>"` 같은 스크립트 문자열도 "숫자여야 합니다" 오류로 정상 차단(별도 이스케이프 불필요 — Number() 변환 실패로 자연스럽게 막힘).
- **날짜 순서**: 퇴사일 < 입사일, 퇴사일 == 입사일 모두 "퇴사일은 입사일보다 늦어야 합니다" 오류로 차단 확인.

## Copy / Reset
- SPEC.md/DESIGN_SYSTEM.md에 "Copy(결과 복사)" 기능 요구사항은 없으며 ui.tsx에도 구현되어 있지 않음 — 해당 없음(결함 아님).
- **Reset(`handleReset`, ui.tsx L208-213)**: 코드 확인 결과 `setForm(EMPTY_FORM)`으로 7개 입력 필드 전부를 빈 문자열로 되돌리고, `setErrors([])`, `setResult(null)`, `setAppliedInput(null)`까지 함께 초기화한다 — 입력값·오류 메시지·계산 결과가 모두 완전히 리셋됨을 코드로 확인. 별도의 "샘플 값 채우기"(`handleFillSample`) 버튼도 FORMULA.md 예제 3 값으로 정상 채움을 코드로 확인.

## Console Error
- 실제 브라우저 콘솔은 확인 불가(Playwright 미설치). 대신 **서버(SSR) 콘솔 로그**를 `npm run start`로 확인 — 페이지 요청(`/calculators/severance-pay`, `/`) 전후로 에러/경고 0건.
- `npm run build` 로그에도 warning 없음(정적 분석 대체 검증).

## Accessibility (코드/마크업 정적 분석 — 실제 렌더링된 브라우저로 스크린리더 등 확인은 못함)
- **label 연결**: SSR HTML을 직접 파싱해 확인 — `<label for="...">` 7개, `<input id="...">` 7개가 모두 1:1로 매칭됨(`_R_..._-hireDate` 등 React `useId` 기반 접두사로 폼 내에서 고유성 보장). 모든 input에 label이 정상 연결되어 있음을 실측 확인.
- **선택/필수 표시**: 필수 필드는 `aria-required`와 `*` 마크(`aria-hidden`으로 스크린리더 중복 낭독 방지), 선택 필드는 "(선택)" 텍스트로 명시 — 색상에만 의존하지 않음.
- **오류 메시지 접근성**: 오류 시 `aria-invalid`, `aria-describedby`로 오류 메시지(`role="alert"`)와 도움말 텍스트를 모두 연결. 오류 텍스트는 색상(`text-red-600`)뿐 아니라 문구 자체로도 전달되어 색상 단독 전달이 아님.
- **결과 aria-live**: 결과 섹션 전체를 `<div aria-live="polite">`로 감싸 계산 결과 업데이트를 스크린리더가 인지하도록 처리되어 있음을 코드로 확인. SSR HTML에도 `aria-live="polite"` 속성이 실제로 렌더링됨을 확인.
- **색상 단독 전달 여부**: "지급대상 아님" 안내(amber 배경)와 정상 결과 모두 배경색뿐 아니라 별도의 제목(`<h2>`)과 설명 문단으로 상태를 전달 — 색상에만 의존하지 않음.
- **명도 대비(WCAG AA)**: 실제 렌더링 결과로 측정하지 못함(브라우저 없음) — **미확인**으로 정직하게 남긴다. 사용된 색상 클래스(zinc-500/600, red-600/400, amber 계열, black/white 투명도)는 프로젝트 내 다른 계산기와 동일한 디자인 토큰으로 보이나, 이 계산기 단독으로 대비를 실측하지는 않았다.
- **발견**: 계산 방법(breakdown) 섹션의 근거 법령 라벨(ui.tsx `buildFormulaSteps`)이 FORMULA.md의 최신 재검토 내용과 어긋난다 — 아래 "발견된 이슈" 참고.

## 반응형 / 모바일 (코드 정적 분석 — 실제 뷰포트 렌더링/스크린샷은 브라우저 부재로 수행 못함)
- 최상위 컨테이너: `mx-auto w-full max-w-2xl flex-1 px-4 py-10` — 고정 px 폭 없이 `max-w`+`w-full` 조합으로 모바일 우선 반응형.
- 결과 상세 그리드: `grid grid-cols-1 gap-3 sm:grid-cols-2` — 모바일(기본) 1열, `sm`(640px) 이상에서 2열로 전환. 모바일 우선 패턴 준수.
- 버튼 영역: `flex flex-wrap gap-3` — 좁은 화면에서 버튼이 줄바꿈되어 잘리지 않음.
- `src/` 전체에서 `width:`, `min-width`, `overflow-x` 등 고정 폭/가로 스크롤 유발 가능 스타일을 grep했으나 **매치 없음** — 가로 스크롤을 강제할 만한 하드코딩된 고정 너비를 발견하지 못했다.
- `inputMode`: 날짜 필드(`type="date"`)는 네이티브 날짜 피커를 쓰므로 inputMode 미지정이 적절하고, 금액/시간 필드는 `inputMode="numeric"` 또는 `"decimal"`이 정확히 매핑되어 있음(소수 허용 필드인 `weeklyScheduledHours`만 `"decimal"`, 나머지 정수 금액 필드는 `"numeric"`) — 모바일 숫자 키패드 요건(DESIGN_SYSTEM.md) 충족.
- 320/375/390/768/1440px 각 뷰포트에서의 실제 잘림·터치 영역 확인은 브라우저 부재로 **수행하지 못했다** — 위 코드 패턴 분석으로 대체.

## 발견된 이슈 (등급별)

### Medium
1. **계산 방법(breakdown) 섹션의 근거 법령 라벨이 FORMULA.md 최신 재검토 내용을 반영하지 못함(ui.tsx)**
   - `src/calculators/severance-pay/ui.tsx` L148-149 (`buildFormulaSteps`, 4단계 "상여금·연차수당 가산액 계산"): 라벨이 `"고용노동부 행정해석 임금 68207-120(2003.02.24) / 근로기준과-3295로 추정(1994.5.24, 확인 필요)"`로 표시됨. 그러나 tasks/severance-pay/FORMULA.md는 2026-09-02 재검토로 이 인용을 **"임금근로시간정책팀-3295(2007.11.5)"**로 정정했고, "근로기준과-3295(1994.5.24)"는 "독립 검증 자료를 찾지 못했다 — 오기였을 가능성이 크다"고 명시했다. FORMULA.md는 최종 권위 문서(docs/EVALUATION.md "역할 간 이견 조정")인데, 사용자에게 노출되는 화면은 이미 폐기된 구버전 인용을 그대로 보여주고 있다.
   - 같은 파일 L168-169 (8단계 "최종 반올림"): 라벨이 `"실무 관행(원 단위 반올림/사사오입) — 명문 법령 규정은 확인되지 않음"`으로 표시됨. FORMULA.md는 이 방식이 "moel.go.kr 소스코드(`retire_cal.js` `Math.round`)로 확인됨"이라고 명시적으로 격상했는데(단순 "실무 관행" 추정이 아니라 정부 공식 계산기의 실제 구현임을 소스코드로 확인), UI 텍스트는 이 확인 사실을 반영하지 않고 이전의 더 약한 근거 문구를 그대로 노출한다.
   - 영향: 계산 결과(severancePay)는 정확하다(Golden Test 7개 전부 PASS) — 계산 로직 자체의 결함은 아니다. 다만 SPEC.md Must-Have("각 단계별 수식과 근거 법령 라벨을 노출")가 요구하는 "근거 표시의 정확성"이 훼손되어 있고, 사용자가 실제보다 약한 법적 근거로 오인할 수 있다.
   - 재현: 실제 계산을 1회 수행(폼 제출)하면 "계산 방법" 섹션에서 확인 가능. 이번 QA는 코드 읽기로 확인(브라우저 부재로 실제 클릭 인터랙션은 재현 못함, 대신 소스 L129-173 직접 검토로 확인).

### Low
2. **금액 입력 필드에 상한 검증이 없어 비현실적 극단값에서 부동소수점 정밀도 붕괴 가능**
   - `src/calculators/severance-pay/validation.ts`의 `validateRequiredAmount`/`validateOptionalAmount`는 `weeklyScheduledHours`에만 `max: 168`을 적용하고, `wage3m`/`bonus12m`/`annualLeavePay12m`/`ordinaryDailyWage`에는 상한이 없다.
   - 직접 실행 확인(`calculateSeverancePay`에 `wage3m=1,000,000,000,000,000`(1천조원)과 장기 재직 조건 입력): `severancePay=1701205479452054500`이 반환되었고 `Number.isSafeInteger(severancePay)`가 **false** — JS 배정밀도 부동소수점의 안전 정수 범위(2^53)를 벗어나 결과의 정확성이 이론적으로 보장되지 않는다.
   - 영향: 현실적인 임금 범위(3개월 임금총액이 억 단위를 훨씬 넘는 경우조차)에서는 절대 발생하지 않는 극단값에서만 나타나는 이론적 결함이며, `logic.test.ts`의 "매우 큰 임금총액" 테스트(3개월 3억원, 상여금 1억원 등 현실적 고액 케이스)는 안전 정수 범위 내에서 정상 통과한다. 실사용 리스크는 매우 낮음.

## 판정
**PASS**

- 계산 정확성: Golden Test 7개(FORMULA.md 검증 예제) 포함 39/39 테스트 전부 통과, `tsc`/`eslint`/`build` 모두 클린.
- 입력 검증: 빈 입력/음수/0/매우 큰 값/소수/잘못된 문자 29개 케이스를 직접 실행해 전부 기대대로 차단/통과됨을 확인.
- Console Error 0(서버 로그 기준), TypeScript Error 0.
- 발견된 이슈는 Medium 1건(근거 라벨 최신화 누락 — 계산 자체는 정확), Low 1건(비현실적 극단값에서의 이론적 정밀도 이슈)뿐이며, docs/EVALUATION.md PASS 기준("Critical 0, High 0")을 충족한다.
- 다만 이번 QA는 브라우저(Playwright 등)가 설치되어 있지 않아 **실제 렌더링된 모바일 뷰포트, 실제 브라우저 콘솔, 실측 WCAG 명도 대비는 검증하지 못했다** — 위 각 항목에 명시한 대로 코드/마크업 정적 분석으로 대체했다. 이 제약이 총점 판정을 뒤집을 만한 결함을 놓쳤을 가능성은 낮다고 판단하나(정적 분석으로 반응형/접근성 패턴 자체는 확인됨), 완전한 대체는 아니라는 점을 명시해 둔다.

---

## 재검증 (2026-09-02, Optimizer가 Critic/QA 1차 지적사항을 수정하고 Calculation Auditor 3차·
Critic 재검증이 모두 PASS(단, Critic 재검증에서 신규 Medium 1건 — 콤마 포맷팅 커서 위치 미보정,
PLAUSIBLE/코드추론 기반, 비차단 — 발견)를 받은 이후. 이번 QA 최종 재검증이 목적이다. 1차
QA.md 위 내용은 그대로 보존하고 이 섹션만 추가한다. Edit 권한이 없어 코드는 수정하지 않았다.)

### 환경 / 서버 구동 결과
- 이번 세션에도 `npx playwright`용 devDependency 및 `ms-playwright` 브라우저 캐시가 여전히 없음을
  재확인(`node_modules/.bin`에 playwright 없음, `%LOCALAPPDATA%\ms-playwright` 디렉터리 없음) —
  1차 QA와 동일한 제약이 그대로 유지된다. 이번에도 실제 브라우저 렌더링/콘솔/뷰포트 스크린샷은
  **수행하지 못했다**. 아래는 정적 분석 + 자동 테스트 + SSR HTML 직접 파싱으로 대체 검증했다.

### 1. `npm test` / `tsc --noEmit` / `npm run build` / `npm run lint` 재확인 — **전부 PASS**
- `npm test -- --run`(vitest): **PASS** — 3 test files, **44/44 통과**(1차 QA 시점 39개에서
  logic.test.ts 지급요건 미충족 사유 테스트 1개 + validation.test.ts 콤마/상한 테스트 4개가
  추가돼 44개). Golden Test 7개(FORMULA.md 예제 1~7) 포함, 전부 기존 기댓값 그대로 통과.
- `npx tsc --noEmit`: **PASS** — 출력 없음, 타입 에러 0건.
- `npm run build`(Next.js 16.3.4, Turbopack): **PASS** — "Compiled successfully in 487ms",
  TypeScript 통과, 정적 페이지 6/6 생성 정상(`/`, `/_not-found`, `/calculators/[slug]`,
  `/robots.txt`, `/sitemap.xml`), 빌드 로그에 warning 없음.
- `npm run lint`(`eslint`): **PASS** — 출력 없음, exit code 0, lint 에러/경고 0건.

### 2. `npm run build && npm run start` 서버 구동 후 라우트 응답 재확인 — **PASS**
- `npm run build` 성공 후 `npm run start`(프로덕션 서버, port 3000)로 백그라운드 구동 —
  `✓ Ready in 173ms` 정상 기동.
- `curl http://localhost:3000/calculators/severance-pay` → **HTTP 200**, HTML **18,337바이트**
  정상 응답(1차 QA 시점 17,759바이트에서 콤마 포맷팅 핸들러·사유 안내 `<ul>`·helpText 확장 등
  Optimizer 변경분만큼 자연스럽게 증가 — 회귀 아님).
- `curl http://localhost:3000/` → **HTTP 200**(홈페이지 회귀 없음).
- 서버 콘솔 로그(`npm run start` stdout)를 요청 전후로 확인 — 시작 로그(`Ready in 173ms`,
  `Running next.config.ts`) 외 에러/경고/스택트레이스 없음. Console/TS Error 0 기준 충족.

### 3. Critic 신규 지적("콤마 포맷팅 커서 위치") 재확인 — **확인됨, Medium, 비차단(등급 재산정 아님)**
- `src/calculators/severance-pay/ui.tsx`의 `handleAmountChange`(204~212행) 전체와 파일
  전체를 다시 읽고 `useRef`/`selectionStart`/`selectionEnd`/`setSelectionRange` 키워드로
  grep했다 — **파일 전체에서 이 네 심볼 중 어느 것도 등장하지 않음을 직접 확인했다.**
  ```ts
  function handleAmountChange(field: keyof RawSeverancePayFormInput) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const digitsOnly = event.target.value.replace(/[^0-9]/g, "");
      const formatted = digitsOnly
        ? Number(digitsOnly).toLocaleString("ko-KR")
        : "";
      setForm((prev) => ({ ...prev, [field]: formatted }));
    };
  }
  ```
  입력 이벤트마다 `event.target.value`를 재포맷해 `setForm`으로 필드값 전체를 교체할 뿐, DOM
  input 노드의 커서 위치(offset)를 읽거나 재설정하는 보정 로직이 코드 어디에도 없다는 Critic의
  관찰과 정확히 일치한다.
- 이 세션도 브라우저가 없어(위 참고) 실제 렌더링에서 커서가 튀는 것을 눈으로 재현하지는
  못했다 — Critic의 PLAUSIBLE 판정을 뒤집거나 CONFIRMED로 격상할 근거를 이번 QA도 추가로
  확보하지 못했다는 뜻이다. **작업 지시대로 이 건은 새로 등급을 매기지 않고, "정적 분석으로
  코드상 커서 보정 로직 부재를 재확인함 — Medium, 비차단"으로만 기록한다.**
- 참고: `validation.test.ts`(189~197행)의 콤마 파싱 테스트, `logic.test.ts`의 결과값 테스트
  전부 이 이슈와 무관하게 통과한다 — 이는 커서 위치가 아니라 최종 문자열/숫자값만 검증하므로
  이 UX 결함을 감지할 수 있는 테스트가 애초에 아니다(자동 테스트로는 탐지 불가능한 종류의
  결함이라는 Critic 판단이 QA 관점에서도 타당함을 재확인).

### 4. Accessibility 재확인 — 신규 사유 `<ul>`/`<li>` 및 helpText가 label/aria 구조를 깨지 않음 — **PASS**
- SSR HTML(`curl` 결과, 18,337바이트)을 직접 파싱해 재확인: `<label for="...">` **7개**,
  `<input id="...">` **7개**가 여전히 1:1 매칭(1차 QA와 동일한 개수 — 필드 수 자체는 변경
  없음). `aria-live="polite"` 속성도 결과 컨테이너에 그대로 렌더링됨을 확인(1개).
- `ui.tsx` 356~363행의 신규 사유 목록:
  ```tsx
  <ul className="mt-2 list-disc space-y-1 pl-5 ...">
    {result.insufficientServicePeriod && <li>계속근로기간 1년 이상 — 미충족</li>}
    {result.insufficientWeeklyHours && <li>4주 평균 주당 소정근로시간 15시간 이상 — 미충족</li>}
  </ul>
  ```
  이 `<ul>`/`<li>`는 `<label>`/`<input>` 폼 구조와 무관한 **결과 표시 영역**(346행
  `<div aria-live="polite">` 내부, `<h2>지급대상 아님</h2>` 아래)에 위치한다 — 네이티브
  `<ul>`/`<li>`는 별도 ARIA 속성 없이도 브라우저가 자동으로 list/listitem 역할을 부여하므로
  추가 aria 마크업이 없어도 접근성상 결함이 아니다. 목록은 `aria-live="polite"` 컨테이너
  안에 있으므로 계산 결과가 갱신될 때 스크린리더가 새 사유 목록까지 함께 인지한다(1차 QA가
  확인한 aria-live 구조를 이 신규 목록도 그대로 상속받음).
- helpText 구조(`ui.tsx` 259행 `helpId`, 294~298행 `aria-describedby`, 308~312행
  `<p id={helpId}>`)는 M3 대응으로 `wage3m`/`bonus12m`의 helpText **문자열 내용만** 길어졌을
  뿐, id 생성·`aria-describedby` 연결 로직 자체는 1차 QA 시점과 완전히 동일한 코드 경로를
  그대로 사용한다 — 텍스트 길이가 아니라 구조(id/for/describedby 배선)를 아키텍처 단으로
  보는 QA 관점에서는 이 변경이 label/aria 연결을 깨뜨릴 여지가 코드 구조상 없음을 확인했다.
- 필수/선택 표시(`aria-required`, "(선택)" 텍스트), 오류 `role="alert"`+`aria-describedby`
  배선도 1차 QA 확인 코드 그대로 유지됨을 재확인 — 회귀 없음.
- (1차 QA와 동일한 제약) 실측 WCAG AA 명도 대비는 브라우저 부재로 이번에도 **미확인**으로
  정직하게 남긴다.

### 5. 신규 44개 테스트 — 더미 테스트 여부 판단 — **전부 의미 있는 검증, 더미 없음**
새로 추가된 5개(`logic.test.ts` 1개, `validation.test.ts` 4개)를 원문으로 직접 읽고 판단했다
(1차 QA 39개 → 이번 44개, EVALUATION.md "44/44"와 일치).

- `logic.test.ts`(290~305행) "근속기간·소정근로시간이 둘 다 미충족이면 두 사유 플래그가 모두
  true다": `toEqual({ eligible: false, insufficientServicePeriod: true,
  insufficientWeeklyHours: true })`로 **객체 전체를 완전 일치 비교**한다 — 필드가 하나라도
  빠지거나 다른 값이면 실패하는 엄격한 단언이다. 근속 181일(<365)·주 10시간(<15) 입력으로
  두 조건을 동시에 미충족시켜 "OR 중 하나만 true"가 아니라 "AND로 둘 다 true"를 실제로
  구분해 검증한다 — 더미 아님. 기존 4개 테스트(예제4/5, 364일/14.9시간 경계)도 같은 방식으로
  `toEqual`이 필드 2개를 함께 검증하도록 갱신됐음을 확인(142~148행, 163~169행, 255~261행,
  282~288행) — `eligible: false`만 확인하고 사유 필드는 무시하는 느슨한 테스트가 아니다.
- `validation.test.ts`(159~167행) "wage3m이 상한(100억원)을 초과하면 실패한다":
  `wage3m: "10000000001"`(상한+1) 입력 → `result.success===false` **및**
  `errors.some(e=>e.field==="wage3m")===true`까지 확인 — 단순 실패 여부만이 아니라 올바른
  필드에 오류가 달렸는지까지 검증. 더미 아님.
- (169~175행) "정확히 같으면 통과한다(경계값)": `"10000000000"`(상한과 정확히 일치) →
  `success===true`. 위 초과 테스트와 짝을 이루는 **정확한 경계값 테스트**(off-by-one 검증) —
  둘 중 하나만 있었다면 `>` 대신 `>=`로 잘못 구현돼도 통과했을 것이나, 두 테스트가 짝으로
  있어 실제로 `num > options.max` 구현을 정밀하게 검증한다.
- (177~185행) "선택 입력(bonus12m)이 상한을 초과하면 실패한다": 필수 필드(`wage3m`,
  `validateRequiredAmount`)뿐 아니라 선택 필드(`bonus12m`, `validateOptionalAmount`)의
  별도 코드 경로에도 상한이 실제로 적용되는지 독립적으로 검증 — 필수/선택 두 함수가 각각
  `max` 옵션을 받는 구조이므로, 이 테스트가 없었다면 "필수 필드만 상한이 걸리고 선택
  필드는 빠졌다"는 실수를 놓쳤을 것이다. 더미 아님.
- (189~197행) "wage3m에 천 단위 콤마가 포함돼도 올바르게 숫자로 정규화된다": `"9,200,000"`
  입력 → `success===true` **및** `result.data.wage3m===9_200_000`(콤마가 제거된 순수
  숫자값)까지 확인 — 파싱 성공 여부만이 아니라 **콤마가 실제로 제거된 정확한 숫자**까지
  검증하므로, `Number("9,200,000")`가 `NaN`이 되는 실패 케이스를 실제로 잡아낼 수 있는
  테스트다. 더미 아님.
- 5개 전부 `expect(true).toBe(true)`류의 트리비얼 단언이나 스냅샷만 찍고 끝내는 패턴이
  전혀 없고, 모두 실제 도메인 값(사유 플래그 조합, 상한 경계값, 콤마 정규화 결과)을 구체적으로
  검증한다. **더미 테스트 없음.**

### 최종 판정 — docs/EVALUATION.md PASS 기준 재확인

| 기준 | 재확인 결과 |
|---|---|
| 총점 92점 이상 | EVALUATION.md 점수표는 미기입 상태(정성 판정만 운영 중)이나, 계산 정확성/예외처리/UX/모바일/접근성/성능/설명/SEO/코드품질 각 항목이 아래에서 확인한 대로 Critical·High 없이 전부 충족되어 총점 기준 미달을 시사하는 근거 없음 |
| 계산 정확성 33/35 이상 | Golden Test 7개(FORMULA.md 예제 1~7) 포함 44/44 테스트 전부 통과, Calculation Auditor 3차 감사가 독립 재계산으로 계산 공식 무변경·정확함을 확인 |
| **Critical 0** | 이번 QA 재검증에서 신규 Critical 없음. 1~3차 Auditor·Critic·QA 전 과정에서도 Critical 0건 |
| **High 0** | 이번 QA 재검증에서 신규 High 없음. Critic 재검증(H1 해소 확인) 결과와 일치 |
| **Golden Test 100% PASS** | 7/7 통과 재확인(`npm test` 44/44 중 포함) |
| **Console Error 0, TypeScript Error 0** | 서버 콘솔 로그 확인 결과 에러 0건, `tsc --noEmit` 에러 0건 — 재확인 |
| **Mobile Critical Issue 0** | 브라우저 부재로 실제 뷰포트 테스트는 이번에도 못했으나(1차 QA와 동일 제약), `grid-cols-1 sm:grid-cols-2`/`w-full`/`flex-wrap` 등 모바일 우선 패턴이 Optimizer 변경(사유 `<ul>`, helpText 확장, 콤마 포맷팅) 이후에도 코드상 그대로 유지됨을 재확인 — 고정 폭/가로 스크롤 유발 요소 신규 도입 없음. Critical급 모바일 결함을 시사하는 근거 없음 |

**판정: PASS**

근거:
- 자동화 검증(`npm test` 44/44, `tsc --noEmit` 0 에러, `npm run build` 성공, `npm run lint`
  0 에러/경고) 전부 재확인 완료.
- 프로덕션 서버 구동 후 `/calculators/severance-pay`·`/` 모두 HTTP 200 재확인, 서버 콘솔
  에러 0건.
- Critic 재검증이 신규로 지적한 콤마 포맷팅 커서 위치 이슈는 코드상 보정 로직 부재를
  QA 관점에서도 재확인했다 — Medium, 비차단, 등급 재산정 없이 그대로 유지.
- 신규 `<ul>`/`<li>` 사유 목록과 확장된 helpText 모두 기존 label/aria 배선 구조를 깨지
  않음을 확인했다.
- 신규 44개(누적) 테스트 중 이번 라운드 추가분 5개를 전수 검토한 결과 더미 테스트 없이
  전부 의미 있는 도메인 검증(사유 플래그 조합, 상한 경계값 off-by-one, 콤마 제거 후
  정확한 숫자값)을 수행하고 있음을 확인했다.
- docs/EVALUATION.md PASS 기준(Critical 0, High 0, Golden Test 100%, Console/TS Error 0,
  Mobile Critical 0)을 모두 명시적으로 재확인했다.

### 현재 남아있는 미해결 이슈 종합(EVALUATION.md 전체 취합, QA 관점 재분류 아님 — 원 판정 등급 그대로 인용)

| 출처 | 등급 | 내용 | 상태 |
|---|---|---|---|
| Critic 재검증(신규) | **Medium** | 실시간 콤마 포맷팅이 입력 문자열 중간 편집 시 커서 위치를 예측 불가능하게 이동시킬 수 있음(PLAUSIBLE, 코드 추론 기반, 계산 결과에는 영향 없음) — 이번 QA가 코드상 보정 로직 부재를 재확인 | 미해결, 비차단 |
| Calculation Auditor 2차(신규) | Medium | moel.go.kr 실제 라이브 계산기와 극희귀(약 0.02%) 부동소수점 경계에서 완전히 일치하지 않음(방향은 사용자에게 유리, 원인은 moel 측 부동소수점 버그, 이 프로젝트 설계 결함 아님) | 미해결, 비차단 |
| Calculation Auditor 3차(신규) | Low | `ordinaryDailyWage`(1일 통상임금)에 3개월 총액용 상한(100억원)이 그대로 적용되어, 1일 임금이 상한 근방 + 장기 근속인 비현실적 극단 조합에서 이론적 ±1원 부동소수점 오차 가능(실사용 범위에서는 재현 불가, 이번 라운드 이전보다 오히려 위험 범위 축소) | 미해결, 비차단 |
| Calculation Auditor 1차/2차(유지) | Low | 연차수당 3/12 가산 근거 인용 "임금근로시간정책팀-3295(2007.11.5)"이 2차 출처(worklaw.co.kr)로만 확인, 정부 원문 PDF 미열람("부분 확인" 상태) | 미해결, 비차단 |
| Calculation Auditor 1차/2차(유지) | Low | 연차수당 3/12 산입과 배치되는 대법원 판례의 정확한 사건번호 특정 못함("확인 필요" 유지) | 미해결, 비차단 |
| QA 1차(유지, 계산 로직 자체는 무결함) | Low | 금액 입력 필드(`wage3m` 등)에 이론적으로 비현실적 극단값(1천조원 등) 입력 시 `Number.isSafeInteger`가 false가 되는 부동소수점 정밀도 이론적 결함 — 단, 이번 라운드에 `MAX_AMOUNT_WON`(100억원) 상한이 추가되어 실질적 위험 범위는 크게 축소됨(위 Auditor 3차 Low와 사실상 동일 계열 이슈로 수렴) | 사실상 대부분 해소(상한 추가로 완화), 잔여 위험 매우 낮음, 비차단 |
| 전 라운드 공통(구조적 제약) | 정보성(등급 없음) | 이 환경에 Playwright 등 브라우저가 설치되어 있지 않아 실제 렌더링된 모바일 뷰포트/브라우저 콘솔/실측 WCAG 명도 대비 검증을 어느 QA 라운드에서도 수행하지 못함 — 전부 코드/마크업 정적 분석 + SSR HTML 파싱으로 대체 | 구조적 한계, 결함 아님 |

**Critical/High 등급 미해결 이슈는 없다.** 위 표의 항목은 전부 Medium 이하이며 docs/EVALUATION.md
PASS 기준을 막지 않는다. 다음 라운드가 있다면 우선순위는 (1) 콤마 포맷팅 커서 위치 보정
(`useRef`+`setSelectionRange`), (2) 실제 브라우저(Playwright 설치) 확보 후 모바일 뷰포트·
명도 대비 실측, (3) 연차수당 근거 문서 원문(정부 PDF) 확인 순으로 권고한다.

---

## v2 재검증 (2026-09-02, Builder가 주당 소정근로시간을 필수→선택으로 전환하고 소개/사용안내/FAQ
섹션을 추가한 v2 라운드에서, Calculation Auditor v2 재검증(PASS, Critical 0/High 0/Medium 0/Low 0
신규)과 UX/UI Critic v2 평가(PASS, Critical 0/High 0, 신규 Medium 1건·Low 2건 비차단)를 모두 받은
이후. 이번이 v2 최종 QA 재검증이다. 위 1차·재검증 QA.md 내용은 그대로 보존하고 이 섹션만 새로
추가한다. Edit 권한이 없어 코드는 수정하지 않았다.)

### 환경 / 서버 구동 결과 — 특이사항 1건 발견 후 해결

- 이번 세션에도 `npx playwright`용 devDependency 및 `ms-playwright` 브라우저 캐시가 여전히
  없음을 재확인했다 — 이전 라운드와 동일한 구조적 제약이 그대로 유지된다. 실제 브라우저
  렌더링/콘솔/뷰포트 스크린샷은 이번에도 **수행하지 못했다**. 아래는 정적 분석 + 자동 테스트 +
  SSR HTML 직접 파싱으로 대체 검증했다.
- **특이사항(중요, 투명하게 기록)**: `npm run build && npm run start`를 실행하기 전
  `curl http://localhost:3000/calculators/severance-pay`를 먼저 시도한 결과 이미 **HTTP 200**이
  응답됐다 — 이전 세션에서 뜬 채로 남아 있던 `node.exe`(PID 40148, 시작 시각 02:19:16)가
  port 3000을 여전히 점유하고 있었다. 이 프로세스가 서빙하는 HTML(17,759바이트로 추정)을
  검사한 결과 "자주 묻는 질문"/"저는 4주 평균 주 15시간 미만으로 근무합니다"/`checkbox` 등
  v2 신규 마크업이 **전혀 포함되어 있지 않음**을 확인했다 — 즉 v2 이전(구) 빌드였다. 만약 이
  구버전 위에서 그대로 QA를 진행했다면 "서버 정상 기동·200 확인"이라는 결과가 실제로는 v2
  변경사항을 전혀 검증하지 못한 거짓 양성이 될 뻔했다. `netstat -ano`로 PID를 확인해
  `Stop-Process -Force`로 종료한 뒤 `npm run build && npm run start`를 다시 실행해 이후 모든
  검증은 **이번 세션에서 새로 빌드·기동한 서버**를 대상으로 재확인했다(아래 1~7번 전부 이
  재기동 이후 결과). 이는 코드 결함이 아니라 QA 세션 위생(이전 세션이 서버를 종료하지 않고
  남긴) 문제이므로 등급을 매기지 않지만, 향후 라운드에서도 서버를 새로 띄우기 전에 반드시
  포트 점유 여부와 응답 내용의 최신성을 함께 확인할 것을 권고한다.

### 1. `npm test` / `tsc --noEmit` / `npm run build` / `npm run lint` 재확인 — **전부 PASS**

- `npm test -- --run`(vitest): **PASS** — 3 test files, **51/51 통과**(EVALUATION.md v2 Builder
  산출물 확인치 "51/51"과 일치. logic.test.ts 33개[Golden 7 + Edge Case 20 + v2 신규 6],
  validation.test.ts 21개... 등). Golden Test 7개(FORMULA.md 예제 1~7) 포함, 전부 기존 기댓값
  그대로 통과.
- `npx tsc --noEmit`: **PASS** — 출력 없음, 타입 에러 0건.
- `npm run build`(Next.js 16.3.4, Turbopack): **PASS** — "Compiled successfully in 467ms",
  TypeScript 통과, 정적 페이지 7/7 생성 정상(`/`, `/_not-found`, `/calculators/[slug]`(v2
  신규 렌더링 포함), `/robots.txt`, `/sitemap.xml`), 빌드 로그에 warning 없음.
- `npm run lint`: **PASS** — 출력 없음, exit code 0, lint 에러/경고 0건.

### 2. `npm run build && npm run start` 서버 구동 후 라우트 응답 + v2 신규 섹션 렌더링 확인 — **PASS**

- (위 "특이사항" 참고) 구 프로세스 종료 후 재기동 — `✓ Ready in 114ms` 정상 기동.
- `curl http://localhost:3000/calculators/severance-pay` → **HTTP 200**, HTML **25,836바이트**
  (v2 재검증 시점 18,337바이트 대비 크게 증가 — IntroSection/UsageGuide/FaqAccordion/체크박스
  블록이 SSR HTML에 실제로 추가된 결과와 정합적인 증가폭이며 회귀 아님).
- `curl http://localhost:3000/` → **HTTP 200**(홈페이지 회귀 없음).
- SSR HTML을 직접 문자열 검색해 v2 신규 섹션이 실제로 렌더링됐는지 확인(정규식이 아니라 정확한
  문자열 매치 카운트):

  | 검색 문자열 | 매치 수 | 의미 |
  |---|---|---|
  | "퇴직금 계산기란 무엇인가요"(IntroSection 제목) | 1 | 소개 섹션 렌더링 확인 |
  | "사용 방법"(UsageGuide 기본 제목) | 1 | 사용 안내 섹션 렌더링 확인 |
  | "자주 묻는 질문"(FaqAccordion 기본 제목) | 1 | FAQ 섹션 렌더링 확인 |
  | "저는 4주 평균 주 15시간 미만으로 근무합니다" | 1 | 체크박스 라벨 텍스트 렌더링 확인 |
  | `checkbox` | 1 | `<input type="checkbox">` 실제 렌더링 확인 |
  | `aria-live` | 1 | 결과 영역 aria-live 컨테이너 유지 확인 |

  6개 신규 마크업 표지가 전부 정확히 1회씩 SSR HTML에 존재함을 확인했다 — 페이지 소스 코드가
  아니라 **실제로 서버가 내려준 응답 바이트** 기준으로 확인한 것이므로, "코드는 있지만 실제로
  렌더링에는 실패했다"는 종류의 결함(예: 조건부 렌더링 오류, import 누락으로 인한 조용한 실패)이
  아님을 실측으로 확인했다.
- `<label for="...">` 7개, `<input id="...">` 7개가 여전히 1:1 매칭됨을 SSR HTML에서 재확인
  (필드 개수 자체는 변화 없음 — `weeklyScheduledHours`가 필수 블록에서 별도 선택 블록으로
  이동했을 뿐 입력 자체는 그대로 존재).
- 서버 콘솔 로그(`npm run start` stdout)를 재기동·요청 전후로 확인 — 시작 로그(`Ready in
  114ms`, `Running next.config.ts`) 외 에러/경고/스택트레이스 없음.

### 3. v1 재검증이 남긴 신규 Medium("콤마 포맷팅 커서 위치") — 이번 v2 라운드 영향 재확인 — **무변화, 비차단으로 유지**

- 작업 지시대로, 이 이슈가 v2 변경으로 "우연히라도" 영향받았는지 확인했다. `ui.tsx`의
  `handleAmountChange`(283~291행) 원문을 v1 재검증 QA.md가 인용한 코드와 한 글자씩 대조했다 —
  **완전히 동일하다**(digitsOnly 정규식, `toLocaleString("ko-KR")`, `setForm` 호출 순서·문자열
  전부 무변화). `useRef`/`selectionStart`/`selectionEnd`/`setSelectionRange` 키워드로 `ui.tsx`
  전체를 다시 grep한 결과도 이전과 동일하게 **0건**이다 — v2 라운드에서도 커서 보정 로직이
  추가되지 않았다.
- v2에서 이 핸들러의 호출 대상 필드 구성도 바뀌지 않았다 — `isAmount = field.unit === "원"`
  판정 기준(342행)과 `FIELDS` 배열의 금액 필드 4개(wage3m/bonus12m/annualLeavePay12m/
  ordinaryDailyWage)는 v1과 동일하다. `weeklyScheduledHours`는 원래도 `unit`이 "시간"이라
  `handleAmountChange`가 아니라 `handleChange`를 쓰고 있었고(콤마 이슈와 무관), v2에서 그 필드가
  체크박스 블록으로 이동한 뒤에도 여전히 `onChange={handleChange("weeklyScheduledHours")}`
  (482행)로 동일 핸들러를 그대로 쓴다 — 콤마 포맷팅 경로 자체에 새로 편입되지도, 제외되지도
  않았다.
- **결론: v2 변경은 이 Medium 이슈에 어떤 영향도 주지 않았다** — 악화되지도, 우연히 해소되지도
  않고 정확히 이전 상태 그대로 유지된다. 여전히 브라우저가 없어 실제 렌더링에서 커서가 튀는
  현상을 육안 재현하지는 못했으므로(PLAUSIBLE 판정을 뒤집을 근거 없음), 이전과 동일하게
  "Medium, 비차단, 등급 재산정 없음"으로 그대로 기록한다.

### 4. 신규 필드(체크박스 + 선택 숫자 입력) 접근성 — **레이블 연결은 적절, 상태 변경 시 스크린리더 인지는 Critic 지적대로 미흡(회귀 아닌 기존 갭 재확인)**

- **레이블 연결**: 체크박스는 `<label className="flex items-start gap-2 text-sm"><input
  type="checkbox" .../><span>저는 4주 평균 주 15시간 미만으로 근무합니다.</span></label>`
  (`ui.tsx` 454~462행) 구조로, `htmlFor`/`id` 명시적 페어링 대신 **체크박스를 `<label>` 요소
  내부에 직접 중첩**하는 방식(암묵적 라벨 연결, HTML 표준이 인정하는 유효한 대안 패턴)을
  쓴다. SSR HTML에서 실제로 `<input type="checkbox">`가 `<label>` 태그 내부 자식으로
  렌더링됨을 확인했다 — 스크린리더가 체크박스에 포커스하면 `<span>` 텍스트를 정상적으로
  낭독할 수 있는 구조다. 결함 아님.
- 조건부로 나타나는 숫자 입력(`weeklyScheduledHours`, 470~486행)은 `<label
  htmlFor={`${formId}-weeklyScheduledHours`}>`와 `<input id={`${formId}-weeklyScheduledHours`}
  aria-invalid={...}>`가 명시적 `for`/`id` 페어링을 갖는다(위 2번의 label/input 7:7 매칭에
  이 필드도 포함됨). 다만 이 입력에는 오류 메시지용 `aria-describedby`는 붙어 있으나(487~491행
  `role="alert"`), helpText용 `aria-describedby` 배선은 없다 — 이 필드는 `helpText` prop을
  쓰는 공용 `renderField()` 경로가 아니라 별도로 직접 작성된 블록이라, 바로 아래 보조 문구
  ("정규 근로자로 가정합니다...", 492~496행)가 `aria-describedby`로 입력과 연결되어 있지
  않다. 시각적으로는 보이지만 스크린리더가 입력에 포커스할 때 이 보조 문구를 자동으로 함께
  낭독하지 않을 수 있다 — **Low 신규 발견**(아래 "발견된 이슈" 참고, 정보 접근성 저하이지
  차단 요소는 아님).
- **체크박스 상태 변경 시 스크린리더 인지 가능 여부**: 작업 지시가 요구한 대로 Critic이 지적한
  "aria-live 밖" 이슈(v2 평가 질문 10, Low L2)를 QA 관점에서 코드로 직접 재확인했다.
  `handleUnderFifteenChange`(299~304행)는 `setForm`으로 state만 갱신하고, 그 결과 조건부로
  렌더링되는 블록(464~498행: 체크 시 경고 문구 `<p>`, 미체크 시 숫자 입력 `<div>`)은 **결과
  영역(530행 `<div aria-live="polite">`) 바깥**에 위치한다 — `ui.tsx` 전체에서 이 체크박스
  블록(438~499행)을 감싸는 `aria-live`/`role="status"`/`role="alert"` 속성을 grep했으나
  **매치 없음**을 확인했다. 즉 체크박스를 토글해 숫자 입력 필드가 사라지고 경고 문구로
  바뀌는(또는 반대) 변화는 스크린리더에 자동으로 안내되지 않는다 — Critic v2 평가가 이미
  Low(L2)로 등록한 내용을 QA도 코드 추적으로 동일하게 재확인했다. 다만 Critic이 이미 지적한
  대로 이 변화는 사용자 자신이 방금 클릭한 체크박스 바로 다음에 일어나므로(포커스가 이미 그
  지점에 있어 스크린리더가 DOM 변화를 우연히 인접 낭독할 가능성이 있음), 화면 다른 곳에서
  일어나는 변화보다는 실질적 영향이 제한적이라는 Critic 판단에 QA도 동의한다. **신규 등급
  부여 없이 Critic의 기존 Low L2를 그대로 인용**한다(아래 종합표 참고).

### 5. FaqAccordion 키보드 접근성 — **네이티브 버튼 기반, 키보드로 완전히 조작 가능 — PASS**

- `components/calculator/FaqAccordion.tsx` 63~80행을 코드로 직접 확인했다:
  ```tsx
  <button
    type="button"
    id={buttonId}
    aria-expanded={isOpen}
    aria-controls={panelId}
    onClick={() => setOpenIndex(isOpen ? null : index)}
    ...
  >
  ```
  `<div onClick>`이나 `<a href="#">` 같은 비-네이티브 클릭 트리거가 아니라 **네이티브
  `<button type="button">`**이다 — 브라우저가 기본으로 Tab 키 포커스 이동과 Enter/Space 키
  활성화를 제공하므로, 별도의 `onKeyDown` 핸들러 없이도 키보드만으로 펼치고 닫을 수 있는
  구조임을 코드로 확인했다(별도 `tabIndex`/`role="button"` 흉내가 아니라 진짜 `<button>`이므로
  스크린리더의 "버튼" 역할 자동 인식도 보장된다).
  - `aria-expanded={isOpen}`이 펼침/닫힘 상태를 스크린리더에 전달하고, 화살표 아이콘의
    `rotate-180` 클래스 토글(72~76행)이 시각적으로도 상태를 보여준다 — 색상에만 의존하지
    않음.
  - 펼쳐진 답변 패널은 `<div role="region" aria-labelledby={buttonId}>`(82~86행)로 버튼과
    연결되어, 스크린리더가 "이 영역은 방금 그 질문에 대한 답변"임을 인지할 수 있다.
  - SSR HTML에서도 실제로 `<button>` 태그와 `aria-expanded="false"`(초기 상태, 전부 접힘)가
    렌더링됨을 확인했다(`defaultOpenIndex` 미지정으로 `ui.tsx`가 호출하므로 초기값은 전부
    닫힘 — 코드 확인).
  - 실제 브라우저에서 Tab/Enter 키를 눌러 눈으로 펼침/닫힘을 확인하지는 못했다(Playwright
    부재, 이전 라운드와 동일한 구조적 제약) — 다만 표준 `<button>` 엘리먼트의 키보드 동작은
    브라우저 자체가 보장하는 기본 동작이라, 이 구조라면 실제 브라우저 확인이 결함을 발견할
    가능성은 낮다고 판단한다.

### 6. 입력 검증 — `weeklyScheduledHours` 조합 케이스를 validation.ts 직접 실행으로 확인 — **12/13 기대대로 동작, 1건 신규 결함 발견**

`npx tsx`로 `validateSeverancePayInput`을 13개 조합(미입력/0/음수/소수/상한 경계/체크박스 조합
포함)에 대해 직접 호출했다(스크립트는 스크래치패드에 작성해 실행, 프로젝트에 파일을 남기지
않았다 — QA는 Write 권한을 `QA.md` 작성에만 쓴다).

| 케이스 | 결과 | 판정 |
|---|---|---|
| 미입력 + 체크박스 미체크 | `weeklyScheduledHours=undefined` | 기대대로(미입력→undefined) |
| 미입력 + 체크박스 체크 | `underFifteenHoursDeclared=true` | 기대대로(자진신고 값 보존) |
| `0` + 체크박스 미체크 | `weeklyScheduledHours=0` | 기대대로(0은 "숫자 입력"으로 살아남음, FORMULA.md 정책과 일치) |
| `0` + 체크박스 체크(모순 조합) | `weeklyScheduledHours=0, underFifteenHoursDeclared=true` | 기대대로(둘 다 유효하게 통과 — 우선순위 판정은 logic.ts 몫) |
| `-5`(음수) | 오류: "0 이상이어야 합니다" | 기대대로 차단 |
| `14.5`(소수) | `weeklyScheduledHours=14.5` | 기대대로 통과(소수 허용) |
| `40` + 체크박스 체크(모순 조합) | `weeklyScheduledHours=40, underFifteenHoursDeclared=true` | 기대대로(둘 다 통과, `logic.ts` `determineWeeklyHoursEligibility`가 자진신고를 최우선으로 판정 — v2 재검증 Auditor가 이미 코드로 확인한 우선순위와 일치) |
| `168`(상한 경계) | `weeklyScheduledHours=168` | 기대대로 통과 |
| `169`(상한 초과) | 오류: "168 이하여야 합니다" | 기대대로 차단 |
| `"abc"`(숫자 아님) | 오류: "숫자여야 합니다" | 기대대로 차단 |
| 체크박스 `false` 명시 | `underFifteenHoursDeclared=undefined`(정규화됨) | 기대대로(`raw === true`만 `true`로 인정) |
| 체크박스 `undefined` | `underFifteenHoursDeclared=undefined` | 기대대로 |
| **공백 문자열만(`"   "`)** | **`weeklyScheduledHours=0`** | **기대와 다름 — 신규 결함(아래)** |

**신규 발견(Medium): `weeklyScheduledHours`에 공백 문자열만 입력하면 "미입력"이 아니라 숫자
`0`으로 조용히 파싱되어, 사용자가 의도치 않게 "지급대상 아님"(15시간 미만) 판정을 받을 수
있다.**
- 원인: `validation.ts`의 `hireDate`/`retireDate`는 `raw.hireDate?.trim()`으로 먼저 trim한
  뒤 빈 문자열 여부를 검사하지만(184~185행), `weeklyScheduledHours`가 거치는
  `toOptionalNumber()`(91~98행)는 `value === undefined || value === null || value === ""`만
  검사하고 **trim을 하지 않는다**. 공백만 있는 문자열(`"   "`)은 이 세 조건 중 어디에도
  해당하지 않아 그대로 `Number("   ".replace(/,/g,""))`로 넘어가는데, JS의 `Number("   ")`는
  `NaN`이 아니라 **`0`**을 반환한다(공백 문자열에 대한 JS `Number()`의 특이 동작). 그 결과
  `toOptionalNumber("   ")`가 `0`(유효한 값)을 반환하고, `validateOptionalAmount`는 이를
  `undefined`가 아닌 실제 입력값 `0`으로 통과시킨다.
- **UI에서 실제로 도달 가능한지 직접 코드 경로로 확인**: `wage3m` 등 금액 필드는
  `handleAmountChange`(283~291행)가 `event.target.value.replace(/[^0-9]/g, "")`로 숫자가
  아닌 모든 문자(공백 포함)를 매 입력마다 즉시 제거하므로, 이 필드들은 UI를 통해 공백만
  남은 문자열이 `validateSeverancePayInput`까지 도달할 경로가 없다. 그러나
  `weeklyScheduledHours`는 `handleChange`(271~275행, `event.target.value`를 가공 없이 그대로
  state에 저장)를 쓴다 — 사용자가 이 필드에 스페이스바를 누르거나(예: 실수로 스페이스 입력
  후 지우려다 만 경우), 공백이 섞인 값을 다른 곳에서 복사해 붙여넣는 경우(예: 스프레드시트
  셀의 트레일링 스페이스) **실제로 도달 가능한 입력 경로**다.
- **`logic.ts`로 이어지는 영향까지 코드로 추적**: `determineWeeklyHoursEligibility`(152~167행)의
  판정 조건은 `weeklyScheduledHours != null`이다. `0 != null`은 `true`이므로 공백 입력으로
  만들어진 `0`은 "숫자가 입력됨" 분기로 들어가 `0 < 15` → `insufficientWeeklyHours: true,
  reason: "belowThreshold"`로 판정된다 — 즉 **사용자가 필드를 사실상 비워 둔 것처럼 보이는
  입력(공백만 있어 눈에 보이지 않음)이 "정규 근로자로 가정"(우선순위 3번, 충족 간주)이 아니라
  "숫자 0시간을 입력해 요건 미충족"으로 처리되어, 실제로는 자격이 있을 수도 있는 사용자에게
  "지급대상 아님"이라는 확정적 오판정을 내놓는다.** 오류 메시지도 뜨지 않으므로(0은 validation
  단계를 통과하는 유효값) 사용자는 왜 "지급대상 아님"이 나왔는지 인지하기 어렵다 — 입력창에는
  공백이 남아 있어 육안으로는 "빈 칸처럼" 보이기 때문에 더욱 그렇다.
- **등급: Medium.** 계산 자체(severancePay 금액)에는 영향이 없고 — 지급요건 미충족으로
  조기 반환되므로 5~8단계 금액 계산 코드가 아예 실행되지 않는다(Auditor v2 재검증이 이미
  확인한 구조와 동일) — 앱이 죽거나 잘못된 금액을 보여주는 것은 아니다. 다만 오류 메시지 없이
  **자격이 있을 사용자에게 잘못된 "지급대상 아님" 확정 판정**을 조용히 내놓는다는 점에서
  단순 UX 흠집보다는 무겁게, Critical/High(계산 결과 오류·앱 크래시 수준)보다는 가볍게 판단해
  Medium으로 분류한다. 수정 제안: `toOptionalNumber()` 진입 시 문자열이면 먼저 `.trim()`한
  뒤 빈 문자열 검사를 하도록 한 줄만 추가하면 해소 가능하다(`hireDate`/`retireDate`가 이미
  쓰는 것과 동일한 패턴).
- 부수 확인: 이 패턴(`toOptionalNumber`가 trim 없이 공백을 `0`으로 흡수하는 것) 자체는
  `wage3m`/`bonus12m`/`annualLeavePay12m`/`ordinaryDailyWage`에도 동일하게 존재하지만, 위에서
  확인한 대로 이 필드들은 `handleAmountChange`가 공백을 포함한 비숫자 문자를 입력 즉시
  걸러내므로 **실제 UI 경로로는 도달 불가능**하다 — `weeklyScheduledHours` 1개 필드에 한정된
  실사용 리스크다.

### 7. 모바일/반응형 — 신규 카드 섹션 포함 재확인 — **PASS, 가로 스크롤 유발 요소 없음**

- `src/`와 `components/calculator/` 전체를 `width:`/`min-width`/`overflow-x`/`w-[`/`px-[`
  패턴으로 grep했다 — **양쪽 모두 매치 없음**. v2에서 새로 추가된 4개 컴포넌트
  (`SectionCard`/`UsageGuide`/`IntroSection`/`FaqAccordion`)를 포함해도 고정 폭/가로 스크롤
  유발 스타일이 신규로 들어오지 않았다.
- `SectionCard.tsx`(48~52행): `<section className="rounded-lg border ... ${className}">`
  안에 `<div className="flex items-start gap-3">`, 텍스트 컬럼은 `<div className="min-w-0
  flex-1">` — `min-w-0`이 flex 자식의 기본 `min-width: auto`로 인한 오버플로(긴 텍스트가
  flex 컨테이너를 강제로 넓히는 흔한 버그 패턴)를 명시적으로 차단하는 표준 Tailwind 패턴이다.
  아이콘이 있는 경우 `h-8 w-8 shrink-0`으로 고정 크기를 주되 `shrink-0`으로 좁은 화면에서도
  아이콘이 찌그러지지 않게 하면서, 텍스트 쪽만 유연하게 줄어드는 모바일 우선 레이아웃이다.
- `UsageGuide.tsx`(43~49행)의 번호 배지도 동일하게 `shrink-0`(고정), 설명 텍스트는
  `min-w-0`(유연) 조합.
- `FaqAccordion.tsx`(69행) 버튼은 `flex w-full items-center justify-between gap-3` — 질문
  텍스트가 길어도 `w-full`이 부모 폭을 넘지 않게 하고, 화살표 아이콘은 `shrink-0`(72~76행)로
  줄어들지 않는다.
- `IntroSection.tsx`는 별도 레이아웃 클래스 없이 `SectionCard`의 `space-y-3` 텍스트 블록만
  쓴다 — 폭 관련 신규 위험 요소 없음.
- 기존 결과 그리드(`grid grid-cols-1 sm:grid-cols-2`, ui.tsx 579·641행)와 버튼 영역(`flex
  flex-wrap gap-3`, 505행)도 v1/1차 QA가 확인한 것과 동일한 클래스 그대로 유지됨을 재확인했다.
- 320/375/390/768/1440px 각 뷰포트에서의 실제 잘림·터치 영역 확인은 이번에도 브라우저 부재로
  **수행하지 못했다** — 위 코드 패턴 분석(shrink-0/min-w-0/flex-wrap/grid-cols-1 조합)으로
  대체했다. 새로 도입된 4개 컴포넌트 모두 이 프로젝트의 기존 모바일 우선 관례를 따르고 있어
  회귀 위험은 낮다고 판단한다.

### 발견된 이슈 (등급별, 이번 v2 재검증 신규분만 — 위 종합표에 전체 취합)

**Medium (신규)**
- **[신규] `weeklyScheduledHours`에 공백 문자열만 입력하면 미입력이 아니라 숫자 `0`으로 조용히
  파싱되어 자격이 있을 사용자에게 오류 메시지 없이 "지급대상 아님" 오판정을 내놓을 수 있다.**
  (`src/calculators/severance-pay/validation.ts` `toOptionalNumber()`, 91~98행 — 위 6번 참고)

**Low (신규)**
- **[신규] `weeklyScheduledHours` 선택 숫자 입력의 보조 안내 문구("정규 근로자로 가정합니다...")가
  `aria-describedby`로 입력 필드와 연결돼 있지 않다.** (`ui.tsx` 470~498행 — 위 4번 참고,
  공용 `renderField()` 경로를 쓰지 않는 별도 블록이라 helpText 배선이 빠졌다.)

### v2 재검증 판정: **PASS**

- 자동화 검증(`npm test` 51/51, `tsc --noEmit` 0 에러, `npm run build` 성공, `npm run lint`
  0 에러/경고) 전부 재확인 완료.
- 서버를 **이번 세션에서 새로 재빌드·재기동**해(이전 세션이 남긴 구버전 프로세스를 발견해
  종료한 뒤) `/calculators/severance-pay`·`/` 모두 HTTP 200과 v2 신규 마크업 6종 실제 렌더링을
  SSR HTML 바이트 기준으로 확인했다.
- v1 재검증이 남긴 Medium(콤마 포맷팅 커서 위치)은 v2 변경으로 전혀 영향받지 않았음을 코드
  원문 대조로 확인 — 등급 재산정 없이 그대로 유지.
- 신규 필드 접근성: 체크박스 라벨 연결은 적절(암묵적 `<label>` 중첩), FaqAccordion은 네이티브
  `<button>` 기반이라 키보드로 완전히 조작 가능. 체크박스 토글에 따른 조건부 콘텐츠 전환이
  aria-live 밖에 있다는 Critic Low L2를 QA도 코드로 재확인(신규 등급 아님).
- 입력 검증 직접 실행(13개 조합)에서 **신규 Medium 1건**(공백 문자열이 0으로 파싱되는 결함)을
  발견했다 — UI 경로로 실제 도달 가능하고 오류 없이 잘못된 확정 판정을 내는 결함이라 진지하게
  기록하되, 계산 결과(금액) 자체에는 영향이 없고 재현 조건이 좁아(해당 필드에 공백만 입력)
  Critical/High는 아니다.
- 모바일/반응형: 신규 4개 컴포넌트 포함 가로 스크롤/고정폭 유발 요소 없음, 기존 모바일 우선
  패턴과 일관됨을 재확인.
- **Critical 0, High 0.** docs/EVALUATION.md PASS 기준(Critical 0, High 0)을 충족하므로 최종
  판정은 **PASS**다. 신규 Medium 1건·Low 1건은 비차단이며 다음 라운드에서 처리를 권고한다
  (아래 종합표에 반영).

### 현재 남아있는 모든 미해결 이슈 종합 (EVALUATION.md v1~v2 전체 취합 + 이번 QA v2 재검증 신규분, 원 판정 등급 그대로 인용)

| 출처 | 등급 | 내용 | 상태 |
|---|---|---|---|
| **QA v2 재검증(신규, 이번 라운드)** | **Medium** | `weeklyScheduledHours`에 공백 문자열만 입력 시 미입력이 아니라 숫자 0으로 조용히 파싱되어, 오류 메시지 없이 "지급대상 아님" 오판정을 내놓을 수 있다(`validation.ts` `toOptionalNumber()`가 trim 없이 `Number(" ")===0`을 그대로 흡수). UI 경로로 실제 도달 가능(해당 필드만 `handleChange`를 써서 공백이 걸러지지 않음), 계산 금액 자체에는 영향 없음 | 미해결, 비차단 |
| **QA v2 재검증(신규, 이번 라운드)** | **Low** | `weeklyScheduledHours` 선택 입력의 보조 안내 문구가 `aria-describedby`로 연결돼 있지 않아 스크린리더가 입력 포커스 시 자동 낭독하지 않을 수 있음(`ui.tsx` 470~498행, 공용 `renderField()` 미사용 블록) | 미해결, 비차단 |
| Critic 재검증(v1, 유지) | Medium | 실시간 콤마 포맷팅이 입력 문자열 중간 편집 시 커서 위치를 예측 불가능하게 이동시킬 수 있음(PLAUSIBLE, 코드 추론 기반, 계산 결과에는 영향 없음) — v2 QA가 이번에도 코드상 보정 로직 부재 및 v2 무영향을 재확인 | 미해결, 비차단 |
| Critic v2 평가(신규) | Medium | 소개(IntroSection) 카드가 시각적 계층 없이 "제목 + 긴 문단 하나"로만 구성돼, 이번 라운드가 목표로 한 카드 디자인 개선의 인상이 페이지 첫 화면부터 약해짐(`icon`/`highlights` prop 미사용) | 미해결, 비차단 |
| Critic v2 평가(신규) | Low | 페이지 헤더 부제와 IntroSection 첫 문단이 핵심 정보를 거의 동일한 문장으로 반복해 사용자가 진입 직후 유사한 내용을 두 번 읽음 | 미해결, 비차단 |
| Critic v2 평가(신규) | Low | 체크박스 토글에 따른 조건부 콘텐츠 전환(숫자 입력 ↔ 경고 문구)이 aria-live 영역 밖에 있어 스크린리더에 명시적으로 안내되지 않음(QA v2도 코드로 재확인, 위 4번) | 미해결, 비차단 |
| Calculation Auditor 2차(유지) | Medium | moel.go.kr 실제 라이브 계산기와 극희귀(약 0.02%) 부동소수점 경계에서 완전히 일치하지 않음(방향은 사용자에게 유리, 원인은 moel 측 부동소수점 버그, 이 프로젝트 설계 결함 아님) | 미해결, 비차단 |
| Calculation Auditor 3차(유지) | Low | `ordinaryDailyWage`(1일 통상임금)에 3개월 총액용 상한(100억원)이 그대로 적용되어, 1일 임금이 상한 근방 + 장기 근속인 비현실적 극단 조합에서 이론적 ±1원 부동소수점 오차 가능(실사용 범위에서는 재현 불가) | 미해결, 비차단 |
| Calculation Auditor 1차/2차(유지) | Low | 연차수당 3/12 가산 근거 인용 "임금근로시간정책팀-3295(2007.11.5)"이 2차 출처(worklaw.co.kr)로만 확인, 정부 원문 PDF 미열람("부분 확인" 상태) | 미해결, 비차단 |
| Calculation Auditor 1차/2차(유지) | Low | 연차수당 3/12 산입과 배치되는 대법원 판례의 정확한 사건번호 특정 못함("확인 필요" 유지) | 미해결, 비차단 |
| QA 1차(유지, 계산 로직 자체는 무결함) | Low | 금액 입력 필드에 이론적으로 비현실적 극단값 입력 시 `Number.isSafeInteger`가 false가 되는 부동소수점 정밀도 이론적 결함 — `MAX_AMOUNT_WON`(100억원) 상한 추가로 실질적 위험 범위는 크게 축소됨(위 Auditor 3차 Low와 사실상 동일 계열로 수렴) | 사실상 대부분 해소, 잔여 위험 매우 낮음, 비차단 |
| 전 라운드 공통(구조적 제약) | 정보성(등급 없음) | 이 환경에 Playwright 등 브라우저가 설치되어 있지 않아 실제 렌더링된 모바일 뷰포트/브라우저 콘솔/실측 WCAG 명도 대비 검증을 어느 QA 라운드에서도 수행하지 못함 — 전부 코드/마크업 정적 분석 + SSR HTML 파싱으로 대체 | 구조적 한계, 결함 아님 |

**Critical/High 등급 미해결 이슈는 여전히 없다.** 위 표의 모든 항목은 Medium 이하이며
docs/EVALUATION.md PASS 기준(Critical 0, High 0)을 막지 않는다. 다음 라운드가 있다면 우선순위는
(1) `weeklyScheduledHours` 공백 입력 trim 처리(신규 Medium, `toOptionalNumber()`에 한 줄
`.trim()` 추가로 해소 가능한 낮은 비용 수정), (2) 콤마 포맷팅 커서 위치 보정(`useRef`+
`setSelectionRange`), (3) IntroSection 카드 시각적 계층 보강(`icon`/`highlights` prop 활용),
(4) 체크박스 조건부 블록에 `aria-live` 추가, (5) 실제 브라우저(Playwright 설치) 확보 후 모바일
뷰포트·명도 대비 실측, (6) 연차수당 근거 문서 원문(정부 PDF) 확인 순으로 권고한다.


---

## 3차 재검증 (2026-09-02, Optimizer가 입사일/퇴사일 date input의 연도 자릿수 버그를 수정한
이후 — `ui.tsx`에 `min`/`max` HTML 속성 추가, `validation.ts`에 연도 범위 검증
`hasPlausibleYearDigits`/`isDateWithinAllowedRange`/`MIN_ALLOWED_DATE`/`getMaxAllowedDate()`
신규 추가. 위 1차·재검증·v2 재검증 QA.md 내용은 그대로 보존하고 이 섹션만 추가한다. Edit 권한이
없어 코드는 수정하지 않았다.)

### 환경 / 서버 구동 결과 — 유령 프로세스 재발 확인 후 정리, 재빌드·재기동

- **작업 지시대로 서버 구동 전에 먼저 기존 프로세스 점유 여부를 확인했다.** `Get-NetTCPConnection
  -LocalPort 3000`으로 확인한 결과 **이번에도** port 3000이 이미 점유되어 있었다(PID 25116,
  `node.exe`, 시작 시각 2026-09-02 18:17:20 — 이번 세션 시작 이전에 뜬 이전 세션의 잔존
  프로세스). v2 재검증 QA.md가 이미 한 차례 경고했던 바로 그 실수가 재발할 뻔한 상황이었다.
  - 종료 전에 이 유령 프로세스가 실제로 무엇을 서빙하고 있었는지 먼저 확인했다:
    `curl http://localhost:3000/calculators/severance-pay` → HTTP 200, **26,040바이트**, 응답
    HTML에 `min="`이 **0건**(grep 결과 없음) — 즉 이번 라운드의 핵심 변경사항(`min`/`max` 속성)이
    반영되지 않은 **구버전 빌드**였다. 이 위에서 그대로 확인을 진행했다면 "서버 정상 응답·200"
    이라는 결과가 이번 라운드 변경사항을 전혀 검증하지 못하는 거짓 양성이 될 뻔했다.
  - `Stop-Process -Id 25116 -Force`로 종료 후 `Get-NetTCPConnection -LocalPort 3000`이 빈
    결과를 반환함을 확인해 포트가 완전히 비었음을 재확인했다.
- 포트를 비운 뒤 `npm run build`(신규 재빌드) → `npm run start`(신규 재기동) 순서로 진행했고,
  아래 모든 확인은 **이번 세션에서 새로 빌드·기동한 서버**를 대상으로 했다.
- 확인 작업을 마친 뒤 서버 프로세스를 직접 종료해(`Stop-Process`) 포트 3000을 다시 비워 두고
  QA를 마쳤다 — 다음 라운드가 동일한 유령 프로세스 문제를 겪지 않도록 세션 위생을 지켰다.

### 1. `npm test` / `tsc --noEmit` / `npm run build` / `npm run lint` 재확인 — **전부 PASS**

- `npm test -- --run`(vitest): **PASS** — 3 test files, **59/59 통과**(EVALUATION.md
  Optimizer 산출물 확인치 "59/59"와 일치 — 기존 53개 + `validation.test.ts` 신규 6개[6자리
  연도/5자리 연도/1969년/경계값 미만 초과/hireDate 경계값 통과/retireDate 경계값 통과]).
- `npx tsc --noEmit`: **PASS** — 출력 없음, 타입 에러 0건.
- `npm run build`(Next.js 16.3.4, Turbopack): **PASS** — "Compiled successfully in 497ms",
  TypeScript 통과, 정적 페이지 **7/7** 생성 정상(`/`, `/_not-found`, `/calculators/[slug]`
  (`/calculators/severance-pay` SSG 포함), `/robots.txt`, `/sitemap.xml`), 빌드 로그에 warning
  없음.
- `npm run lint`: **PASS** — 출력 없음, exit code 0, lint 에러/경고 0건.

### 2. 서버 구동 후 실제 HTML의 `min`/`max` 속성 렌더링 확인 — **PASS, 실측 확인**

- 재기동 서버(`✓ Ready in 121ms`)에 `curl -s http://localhost:3000/calculators/severance-pay`
  → **HTTP 200**, HTML **26,108바이트**(유령 프로세스가 서빙하던 구버전 26,040바이트 대비
  소폭 증가 — `min`/`max` 속성 추가분과 자연스럽게 정합적, 회귀 아님).
- 응답 HTML 원문에서 입사일·퇴사일 두 `<input type="date">` 태그를 직접 추출해 확인:
  ```html
  <input id="..._-hireDate" type="date" min="1970-01-01" max="2027-09-02" ... />
  <input id="..._-retireDate" type="date" min="1970-01-01" max="2027-09-02" ... />
  ```
  두 입력 모두 `min="1970-01-01"`(코드의 `MIN_ALLOWED_DATE` 상수와 일치), `max="2027-09-02"`
  (확인일 2026-09-02 + 1년 = 2027-09-02, `getMaxAllowedDate()` 계산과 정확히 일치)가 **실제로
  서버가 내려준 응답 바이트에** 렌더링됨을 실측으로 확인했다 — "코드에는 있지만 실제 렌더링에는
  반영 안 됨" 종류의 결함이 아니다.
- `curl http://localhost:3000/` → **HTTP 200**(홈페이지 회귀 없음).
- 서버 콘솔 로그(`npm run start` stdout)를 전체 curl 요청 전후로 확인 — 시작 로그 외 에러/경고/
  스택트레이스 0건.

### 3. `validation.ts` 신규 연도 검증 로직 — Node(`tsx`)로 직접 호출해 확인 — **대부분 기대대로,
   Low 신규 발견 1건**

`validateSeverancePayInput()`을 스크래치패드에 작성한 스크립트로 10개 케이스에 대해 직접 호출했다
(프로젝트에 파일을 남기지 않음 — QA는 Write 권한을 QA.md에만 사용).

| 케이스 | 입력 | 결과 | 판정 |
|---|---|---|---|
| 6자리 연도(hireDate="123411-09-01") | | BLOCKED — "입사일 형식이 올바르지 않습니다." | 기대대로 차단 |
| 5자리 연도(retireDate="12345-09-01") | | BLOCKED — "퇴사일 형식이 올바르지 않습니다." | 기대대로 차단 |
| 1969년(hireDate="1969-12-31", min 이전) | | BLOCKED — "입사일 연도를 확인해주세요." | 기대대로 차단 |
| hireDate == MIN_ALLOWED_DATE 정확히("1970-01-01") | 경계값 | **PASS**(통과) | 기대대로 통과 |
| retireDate == getMaxAllowedDate() 정확히("2027-09-02") | 경계값 | **PASS**(통과) | 기대대로 통과 |
| retireDate가 max보다 1일 초과("2027-09-03") | | BLOCKED — "퇴사일 연도를 확인해주세요." | 기대대로 차단 |
| retireDate 2년 후("2028-09-02") | max 초과 극단값 | BLOCKED — "퇴사일 연도를 확인해주세요." | 기대대로 차단 |
| "0001-01-01"(4자리이지만 극단값, 코드 주석이 예시로 든 값) | | BLOCKED — 그러나 메시지가 **"입사일 형식이 올바르지 않습니다."**(예상: "입사일 연도를 확인해주세요.") | **차단은 되나 메시지 불일치 — 아래 Low 이슈 참고** |
| "9999-12-31"(4자리이지만 극단값, 코드 주석이 예시로 든 값) | | BLOCKED — "퇴사일 연도를 확인해주세요." | 기대대로 차단·메시지 일치 |
| 정상 케이스("2023-01-01"~"2024-01-01") | | **PASS**(통과) | 기대대로 통과 |

10개 중 9개는 완전히 기대대로 동작한다(경계값 정확 일치 2건, min 이전/max 이후 차단 2건, 극단
자릿수 차단 2건, 정상 통과 1건, "9999-12-31" 극단값도 의도한 메시지로 정확히 차단). **핵심
방어선(브라우저가 만들 수 있는 "123411-09-01" 같은 자릿수 오버플로 값, 그리고 4자리이지만
1970~+1년 범위 밖인 값)은 실제로 막힌다.**

**신규 발견(Low): "0001-01-01" 같은 연도 0000~0099대 입력이 새로 추가된
`hasPlausibleYearDigits`/`isDateWithinAllowedRange` 로직이 아니라, 기존(이번 라운드에서 손대지
않은) `isValidIsoDate()`의 JS `Date.UTC()` 두 자리 연도 자동 보정 특이 동작 때문에 "형식이
올바르지 않습니다"라는 **잘못된** 메시지로 차단된다.**
- 원인을 Node로 직접 재현해 확인: `Date.UTC(1, 0, 1)`(연도=1)을 실행하면 `getUTCFullYear()`가
  **1901**을 반환한다(`Date.UTC(99,0,1)`→1999, `Date.UTC(100,0,1)`→100으로 정확). 이는 JS
  Date API의 잘 알려진 레거시 동작(0~99 연도를 1900번대로 자동 매핑)이며, `isValidIsoDate()`
  (`validation.ts`, 이번 라운드 이전부터 있던 함수, Optimizer가 수정하지 않음)가 이 값으로
  `date.getUTCFullYear() === year`(1901 === 1 → false)를 검사하므로, `hasPlausibleYearDigits`/
  `isDateWithinAllowedRange`(이번 라운드 신규 함수)가 실행되기도 전에 `isValidIsoDate` 단계에서
  "형식이 올바르지 않습니다" 오류로 먼저 걸린다.
- **영향은 매우 제한적이다**: 값은 어느 쪽이든 **결국 차단된다**(입력 거부 자체는 정확) —
  단지 오류 메시지 문구가 "형식"이지 "연도 확인"이 아닐 뿐이다. `MIN_ALLOWED_DATE="1970-01-01"`
  범위상 0000~0099년대 값은 어차피 항상 범위 밖이라 새 로직이 실행됐어도 결과(차단)는 동일했을
  것이다. 사용자가 실제로 1~99년도를 입력할 시나리오도 사실상 없다(브라우저 date picker UI로는
  네 자리 연도 서브필드에 "0001"을 만들기 어렵고, 이 케이스는 프로그래밍적 입력이나 극단적 수동
  조작에서만 도달 가능).
- **코드 주석과의 불일치**: `validation.ts`의 `MIN_ALLOWED_DATE` 위 주석(90~92행 부근)이 "형식은
  4자리이지만 값 자체가 비현실적인 케이스(예: `0001-01-01`, `9999-12-31`)까지는 형식 검증만으로
  잡을 수 없다"고 설명하며 이 두 값을 신규 로직이 잡아야 할 예시로 명시하는데, 실측 결과
  "9999-12-31"은 정확히 그 설명대로 동작하지만 "0001-01-01"은 실제로는 (신규 로직이 아니라)
  기존 형식 검증이 먼저 잡는다 — 주석의 예시 중 절반이 실제 코드 경로와 다르다.
- **등급: Low.** 보안/데이터 무결성상 실질적 구멍은 없음(값은 항상 차단됨), 사용자가 실제로
  마주칠 가능성도 극히 낮음(브라우저 UI로 도달 어려움) — 다만 오류 메시지 정확성과 코드 주석의
  사실관계가 실제 동작과 어긋난다는 점에서 정직하게 Low로 기록한다. 수정 제안: 굳이 고치지
  않아도 기능상 문제는 없으나, 고치려면 `isValidIsoDate()`에서도 `hasPlausibleYearDigits`와
  동일하게 정규식 매치 그룹의 연도 문자열을 직접 자릿수로만 검사(Date 객체 왕복에 의존하지 않음)
  하도록 바꾸거나, 최소한 코드 주석에서 "0001-01-01" 예시를 제거/정정하면 된다.

### 4. Golden Test 7개(금액 계산) — 기존 기댓값과 완전히 동일함을 재확인 — **PASS**

- `logic.test.ts`(Optimizer가 이번 라운드에서 전혀 수정하지 않은 파일)를 직접 읽어 예제 1~7의
  `expect` 단언을 원문으로 재확인했다:
  - 예제 1: `expect(result.severancePay).toBe(7_868_434)`
  - 예제 2: `expect(result.severancePay).toBe(9_994_521)`(통상임금 채택 분기)
  - 예제 3: `expect(result.severancePay).toBe(3_000_000)`
  - 예제 4: 지급요건 미충족(근속 1년 미만, 금액 없음)
  - 예제 5: 지급요건 미충족(소정근로시간 미충족, 금액 없음)
  - 예제 6: `expect(result.severancePay).toBe(3_000_000)`(예제 3과 동일, bonus/leave 미입력 경로)
  - 예제 7: `expect(result.severancePay).toBe(653_068)`(반올림 정책 회귀 테스트)
  이 값들은 2차 Calculation Auditor 감사·직전 EVALUATION.md 3차 재검증이 확인한 값과 **1원 단위
  까지 완전히 동일**하다.
- `npm test -- --run`(위 1번) 결과 59/59 전체 통과에 이 7개가 그대로 포함되어 있어, 코드 실행
  결과로도 값 불변을 재확인했다. Optimizer가 손댄 파일은 `ui.tsx`(입력 필드 `min`/`max` 속성
  추가)와 `validation.ts`(날짜 검증 로직 추가)뿐이고, 두 파일 모두 금액 계산이 시작되기 **이전
  단계(입력 검증/HTML 속성)**에서만 작동한다 — `validateSeverancePayInput`이 성공(`success:
  true`)하면 그 이후 `calculateSeverancePay`로 넘어가는 `SeverancePayInput` 데이터 형태
  (`hireDate`/`retireDate` 등 필드명·타입)에는 변화가 없으므로, 검증 로직이 강화됐다고 해서
  통과한 입력에 대한 계산 결과가 달라질 구조적 이유가 없다. **계산 공식은 이번 라운드에서도
  전혀 건드리지 않았음을 재확인.**

### 발견된 이슈 (등급별, 이번 라운드 신규분)

**Low (신규)**
- **[신규] `validation.ts`의 `isValidIsoDate()`(기존 함수, JS `Date.UTC()` 두 자리 연도 자동
  보정 특이 동작)가 0000~0099년대 연도 입력을 신규 `hasPlausibleYearDigits`/
  `isDateWithinAllowedRange` 로직보다 먼저 "형식이 올바르지 않습니다"로 가로채, 코드 주석이
  예시로 든 "0001-01-01"이 실제로는 그 주석이 설명하는 경로를 타지 않는다.** 값은 결국 항상
  차단되므로(어느 쪽 오류든 입력은 거부됨) 기능적/보안적 결함은 아니며, 실사용 시나리오로
  도달할 가능성도 낮다 — 오류 메시지 정확성과 코드 주석-실제 동작 간 불일치에 한정된 문제.
  (`src/calculators/severance-pay/validation.ts`, `isValidIsoDate` + `MIN_ALLOWED_DATE` 주석
  — 위 3번 참고)

### 3차 재검증 판정: **PASS**

- 작업 지시 5개 항목 전부 수행 완료:
  1. `npm test`(59/59) / `tsc --noEmit`(0 에러) / `npm run build`(7/7 정적 페이지) /
     `npm run lint`(0 에러) 전부 재실행해 PASS 재확인.
  2. 서버 구동 전 기존 프로세스 점유를 먼저 확인해 **실제로 유령 프로세스(구버전 빌드, `min`
     속성 없음)를 발견**하고 종료한 뒤 재빌드·재기동 — v2 라운드가 남긴 경고를 실제로 활용해
     이번에도 재발할 뻔한 거짓 양성을 막았다.
  3. `npm run start` 후 실제 응답 HTML에서 입사일/퇴사일 두 입력 모두
     `min="1970-01-01"`/`max="2027-09-02"`가 실제로 렌더링됨을 curl로 실측 확인.
  4. `validation.ts`의 신규 검증 로직을 Node(`tsx`)로 직접 실행해 6자리/5자리 연도, 1969년(min
     이전), min/max 정확한 경계값(양쪽 모두), 2년 후(max 초과), 그리고 코드 주석이 든 예시값
     ("0001-01-01"/"9999-12-31")까지 총 10개 케이스로 확인 — 9개 완전 일치, 1개(Low, 위 참고)
     차단은 되나 오류 메시지가 코드 주석의 설명과 다름.
  5. Golden Test 7개(`logic.test.ts`, 이번 라운드 미수정 파일)의 금액 기댓값이 이전 라운드
     (2차 Auditor, EVALUATION.md 3차)와 1원 단위까지 완전히 동일함을 원문 대조 + 테스트 실행
     양쪽으로 재확인.
- **Critical 0, High 0, Medium 0(신규), Low 1(신규, 비차단).** docs/EVALUATION.md PASS 기준
  (Critical 0, High 0)을 충족하므로 **PASS**. 이번 라운드에서 계산 공식(logic.ts)은 전혀
  건드리지 않았고 Golden Test 값도 완전히 불변임을 재확인했으며, 이번 버그 수정의 핵심 목표
  (브라우저 네이티브 date input의 연도 자릿수 오버플로 방어)는 UI 속성(실측)과 검증 로직(직접
  실행) 양쪽 모두에서 실제로 동작함을 확인했다.

### 현재 남아있는 모든 미해결 이슈 종합 (EVALUATION.md v1~v2~날짜버그수정 전체 취합 + 이번 3차
재검증 신규분, 원 판정 등급 그대로 인용)

| 출처 | 등급 | 내용 | 상태 |
|---|---|---|---|
| **QA 3차 재검증(신규, 이번 라운드)** | **Low** | `isValidIsoDate()`의 JS `Date.UTC()` 두 자리 연도 자동 보정 특이 동작 때문에 0000~0099년대 입력이 신규 연도범위 검증이 아니라 기존 형식 검증에서 먼저 걸려, 코드 주석 예시("0001-01-01")와 실제 오류 메시지가 어긋남(차단 자체는 정상, 메시지 문구만 부정확) | 미해결, 비차단 |
| QA v2 재검증(유지) | Medium | `weeklyScheduledHours`에 공백 문자열만 입력 시 미입력이 아니라 숫자 0으로 조용히 파싱되어, 오류 메시지 없이 "지급대상 아님" 오판정을 내놓을 수 있다 | 미해결, 비차단 |
| QA v2 재검증(유지) | Low | `weeklyScheduledHours` 선택 입력의 보조 안내 문구가 `aria-describedby`로 연결돼 있지 않음 | 미해결, 비차단 |
| Critic 재검증(v1, 유지) | Medium | 실시간 콤마 포맷팅이 입력 문자열 중간 편집 시 커서 위치를 예측 불가능하게 이동시킬 수 있음(PLAUSIBLE) | 미해결, 비차단 |
| Critic v2 평가(유지) | Medium | 소개(IntroSection) 카드가 시각적 계층 없이 "제목 + 긴 문단 하나"로만 구성됨 | 미해결, 비차단 |
| Critic v2 평가(유지) | Low | 페이지 헤더 부제와 IntroSection 첫 문단 내용 중복 | 미해결, 비차단 |
| Critic v2 평가(유지) | Low | 체크박스 조건부 콘텐츠 전환이 aria-live 밖 | 미해결, 비차단 |
| Calculation Auditor 2차(유지) | Medium | moel.go.kr 실제 라이브 계산기와 극희귀(약 0.02%) 부동소수점 경계 불일치(사용자에게 유리한 방향, moel 측 버그) | 미해결, 비차단 |
| Calculation Auditor 3차(유지) | Low | `ordinaryDailyWage` 상한(100억원)이 3개월 총액용과 동일해 극단 조합에서 이론적 ±1원 오차 가능 | 미해결, 비차단 |
| Calculation Auditor 1차/2차(유지) | Low | 연차수당 3/12 가산 근거 인용 정부 원문 PDF 미열람("부분 확인" 상태) | 미해결, 비차단 |
| Calculation Auditor 1차/2차(유지) | Low | 연차수당 3/12 산입과 배치되는 대법원 판례 사건번호 미특정 | 미해결, 비차단 |
| QA 1차(유지, 사실상 대부분 해소) | Low | 금액 입력 필드 극단값에서의 이론적 부동소수점 정밀도 이슈(`MAX_AMOUNT_WON` 상한 추가로 완화됨) | 사실상 대부분 해소, 비차단 |
| 전 라운드 공통(구조적 제약) | 정보성(등급 없음) | 이 환경에 Playwright 등 브라우저 미설치로 실제 렌더링/콘솔/명도 대비 실측 불가 — 이번 라운드도 SSR HTML 직접 파싱 + Node 직접 실행으로 대체 | 구조적 한계, 결함 아님 |

**Critical/High 등급 미해결 이슈는 여전히 없다.** 위 표의 모든 항목은 Medium 이하이며
docs/EVALUATION.md PASS 기준(Critical 0, High 0)을 막지 않는다. 이번 라운드가 목표로 한 "날짜
연도 자릿수 버그"는 UI 속성(min/max, 실측 렌더링 확인)과 검증 로직(연도 범위 검사, 직접 실행
확인) 양쪽 방어선 모두 실제로 동작하며, 유일한 신규 발견(Low, 코드 주석-실제 동작 불일치)은
차단 기능 자체에는 영향이 없다.
