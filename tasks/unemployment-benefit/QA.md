# QA: 실업급여(구직급여) 계산기

Calculation Auditor·UX/UI Critic 재검증까지 모두 PASS(Critical 0, High 0)한 상태에서 진행한
최종 QA다. Edit 권한 없이 코드를 읽기만 했고, Bash는 포트 정리·빌드·테스트·서버 구동 확인·
`npx tsx`를 통한 `validation.ts` 독립 실행 용도로만 썼다. Write는 이 파일에만 사용했다.

## 사전 정리: 포트 3000

`netstat -ano`로 확인한 결과 포트 3000에 이전 세션에서 남은 것으로 보이는 `node.exe`(PID 53172)가
떠 있었다. `taskkill /F /PID 53172`로 종료하고 포트가 비었음을 재확인한 뒤 QA를 시작했다. QA
진행 중 `npm run start`로 서버를 두 차례 띄웠고, 각 검증 직후 리스닝 PID를 다시 조회해
`taskkill /F`로 정리했다 — QA 종료 시점에 포트 3000은 비어 있다(마지막 확인:
"PORT_3000_FREE").

## 기능 테스트

- `npm test` — **102/102 통과**(vitest, 9개 파일). `logic.test.ts`(Golden 7 + Edge Case 13)와
  `validation.test.ts`(단위 검증 9 + Golden 재현 7)를 포함해 severance-pay 등 나머지 파일까지
  전부 그린.
- `npx tsc --noEmit` — 출력 없음(오류 0).
- `npm run build`(`next build`, Turbopack) — 컴파일·타입체크·정적 페이지 생성까지 전부 성공.
  라우트 표에 `unemployment-benefit`은 없음 — `registry.ts` status가 여전히 `draft`라
  `generateStaticParams`(published만 수집)에 안 잡히기 때문이며, 의도된 동작이다.
- `npm run lint`(`eslint`) — 출력 없음(오류 0).
- `npm run build && npm run start` 후 `curl -s -o /dev/null -w "%{http_code}"
  http://localhost:3000/calculators/unemployment-benefit` → **HTTP 200**. `app/calculators/[slug]/page.tsx`
  주석대로 `dynamicParams` 기본값(true)이 살아있어 SSG 목록에 없어도 요청 시점 렌더링으로
  접근 가능함을 실측으로 확인했다.
- 같은 서버에서 `/`(홈)도 200, `/sitemap.xml`·홈 HTML 어디에도 `unemployment-benefit` 문자열이
  0건 — draft 계산기가 SEO 노출 표면에서 정확히 제외됨을 확인했다(SPEC/설계 의도와 일치, 결함
  아님).
- `generateMetadata`(`app/calculators/[slug]/page.tsx` 46~48행)가 `status !== "published"`이면
  빈 메타데이터(`{}`)를 반환하도록 되어 있어, 실제 `curl` 응답의 `<title>`도 루트 레이아웃 기본값
  "계산기 모음"으로 나온다 — draft 상태의 기존 설계 그대로이며 새로운 문제가 아니다.

## 모바일 테스트 (320 / 375 / 390 / 768 / 1440px)

실제 브라우저/디바이스 에뮬레이터가 이 환경에 없어(devDependencies에 Playwright/Puppeteer 등
E2E 브라우저 도구 없음, `package.json` 확인) 뷰포트별 스크린샷 실측은 하지 못했다. 대신
`ui.tsx` 클래스 패턴을 정적으로 감사했다:
- `Grep`으로 `w-[...]`/`width: 숫자`/`min-w-[...]` 같은 고정폭 패턴을 검색한 결과 **0건**
  (`shadow-[0_16px_...]` 같은 임의값은 그림자이지 너비가 아님).
- 레이아웃은 `max-w-6xl`(컨테이너), `grid gap-4 sm:grid-cols-2`(초단시간/장애인 체크박스),
  `grid grid-cols-1 sm:grid-cols-2`(계산 상세 dl, 적용된 입력값 dl), `lg:grid-cols-2`(사용
  안내/소개)처럼 전부 상대 단위·브레이크포인트 기반이라 320px 같은 좁은 뷰포트에서도 1열로
  자연스럽게 접힐 구조다.
- 이 컴포넌트가 재사용하는 `SectionCard`/`IntroSection`/`UsageGuide`는 severance-pay와 공유하는
  기존 컴포넌트라 이미 검증된 반응형 패턴이다(EVALUATION.md UX/UI Critic 질문 7 확인 사항과
  동일 결론).
- **한계 고지**: 이는 정적 코드 감사이지 실제 렌더 확인이 아니다 — 다음 라운드에서 실제
  브라우저 뷰포트 스크린샷 확인을 권고한다(Low, 신규는 아님 — 애초에 이 환경의 도구 한계).

## 브라우저 테스트

이 환경에 헤드리스 브라우저 도구가 없어 실제 브라우저 렌더링·Console 로그를 직접 관찰하지는
못했다(위 "모바일 테스트"와 동일한 환경 제약). 대신:
- `npx tsc --noEmit`·`next build`·`eslint` 전부 클린 — 타입 오류, 미사용 변수, 대부분의 JSX
  구조 오류는 이 단계에서 걸러진다.
- `curl`로 받은 실제 서버 렌더 HTML(`/tmp/ub_page.html`, 26,324 bytes)에서 `aria-live="polite"`
  3건(코드의 체크박스 게이팅 안내·가입기간 미리보기·결과 섹션과 정확히 일치), `for="..."`
  라벨 연결 5건(이직일·나이·가입시작일·임금·이직사유 select)을 확인했다 — 서버 렌더 단계에서도
  구조가 깨지지 않는다.
- **한계 고지**: 실제 브라우저의 JS 콘솔 에러(런타임 hydration mismatch 등)는 정적 확인으로
  100% 배제할 수 없다 — 다음 라운드에서 실제 브라우저로 Console 탭 확인을 권고한다(Low, 도구
  한계).

## 입력 검증

`src/calculators/unemployment-benefit/validation.ts`를 `npx tsx`로 직접 import해(Node
런타임에서 실제 소스 그대로 실행, 테스트 파일에 의존하지 않는 독립 실행) 아래 케이스들을
검증했다. 전부 기대한 대로 동작했다 — **결함 없음**.

| 케이스 | 입력 | 결과 |
|---|---|---|
| 빈 입력 전체 | `{}` | 4개 필드 전부 "입력해 주세요" 오류 |
| 음수 나이(-5) | | "15 이상이어야 합니다" |
| 나이 0 | | "15 이상이어야 합니다" |
| 나이 정확히 하한(15)/상한(100) | | 둘 다 성공(경계 포함) |
| 나이 101(상한 초과) | | "100 이하여야 합니다" |
| 나이 14(하한 미만) | | "15 이상이어야 합니다" |
| 나이 소수(30.5) | | "정수여야 합니다" |
| 나이 잘못된 문자("삼십") | | "숫자여야 합니다" |
| 나이 "NaN" 문자열 | | "숫자여야 합니다"(NaN을 유효 숫자로 오인하지 않음) |
| 음수 임금(-1000) | | "0 이상이어야 합니다" |
| 임금 0 | | **성공** — 0원은 유효한 입력(향후 자격 미충족으로 자연 귀결되지 않고 그대로 0원 계산됨. 아래 "발견된 이슈" Low 참고) |
| 임금 소수(1000.5) | | "정수여야 합니다" |
| 임금 잘못된 문자("abc원") | | "숫자여야 합니다" |
| 임금 "Infinity" 문자열 | | "숫자여야 합니다"(무한대를 유효 숫자로 오인하지 않음) |
| 임금 정확히 100억(상한 경계) | | 성공 |
| 임금 100억 초과(10,000,000,001) | | "10,000,000,000 이하여야 합니다" |
| 콤마 포함 정상 금액("1,000,000") | | 성공(콤마 제거 후 파싱) |
| 공백만 있는 임금("   ") | | trim 후 빈 값으로 취급 → "입력해 주세요"(0으로 잘못 해석되지 않음) |
| 가입시작일이 이직일보다 늦음 | `insuredStartDate="2025-01-01"`, `leaveDate="2020-01-01"` | "고용보험 가입 시작일은 이직일보다 늦을 수 없습니다" |
| 가입시작일 = 이직일(같은 날) | | 성공, `insuredPeriodDays=0` → 이후 180일 미충족으로 자연 귀결(설계대로) |
| 이직일 존재하지 않는 날짜(2026-02-30) | | "이직일 형식이 올바르지 않습니다" |
| 이직일 형식 오류(슬래시, "2026/08/01") | | "이직일 형식이 올바르지 않습니다" |
| 이직일 공백 문자열 | | trim 후 "입력해 주세요"(형식 오류로 오분류되지 않음) |
| 연도 자릿수/범위 밖(9999-01-01) | | "이직일 연도를 확인해주세요"(허용 범위 밖 차단) |

Golden Test와 동일 카테고리(빈 입력/음수/0/매우 큰 값/소수/잘못된 문자/이직일보다 늦은
가입시작일)를 전부 실측했고, `validation.test.ts`에 이미 있는 9개 단위 테스트·7개 Golden 재현
테스트와도 상충하는 결과가 없었다.

## Copy / Reset

- "초기화" 버튼(`handleReset`, ui.tsx 351~356행) — `form`을 `EMPTY_FORM`으로, `errors`/
  `outcome`/`appliedInput`을 전부 초기값으로 되돌린다. 코드상 부분 초기화 누락 없음.
- "샘플 값 채우기"(`handleFillSample`, 358~363행) — `SAMPLE_FORM`으로 채우되
  `voluntaryLeaveAcknowledged`는 `prev` 값을 유지(의도적으로 자기 확인 절차를 자동으로
  건너뛰지 않게 설계 — EVALUATION.md UX/UI Critic 질문 9 결론과 일치). `errors`/`outcome`/
  `appliedInput`도 초기화한다.
- 이 계산기에는 "결과 복사(Copy)" 버튼 자체가 없다(severance-pay와 달리 SPEC.md/FORMULA.md
  어디에도 Copy 요구사항이 없음 — grep으로 `navigator.clipboard`/"복사" 문자열이 이
  계산기 파일에 없음을 확인했다). 요구사항 밖이므로 결함으로 잡지 않는다.

## Console Error

소스에 `console.log`/`console.warn`/`console.error` 잔재가 없음을 grep으로 확인했다(0건).
실제 브라우저 콘솔 관찰은 위 "브라우저 테스트" 한계 고지 참고 — `next build`/`tsc`/`eslint`가
클린한 것으로 런타임 에러 가능성을 상당 부분 좁혔으나 100% 대체하지는 못한다.

## Accessibility

- 모든 텍스트/날짜/select 입력에 `<label htmlFor={inputId}>`가 대응 `id`와 연결됨(렌더 HTML에서
  `for="..."` 5건 실측 확인). 체크박스 3개(비자발적 이직 확인, 초단시간근로자, 장애인)는 `<input>`을
  `<label>`로 감싸는 암묵적 라벨링 패턴 — 유효한 접근성 패턴이다.
- 오류 메시지: `<p role="alert">`(ui.tsx 431행)이며 `aria-describedby`로 해당 입력과 연결됨
  (406~414행, 오류/도움말/미리보기 id를 조건부로 결합). `aria-invalid={message ? true :
  undefined}`도 함께 설정.
- 체크박스 게이팅 관련 `aria-live`: 자기 확인 체크박스 안내 문구(486행), 가입기간 자동 계산
  미리보기(424행), 결과 영역 전체(590행 `<div aria-live="polite">`) 3곳 모두 `aria-live="polite"`
  — 렌더 HTML에서 3건 실측 확인(코드와 정확히 일치).
- 필수 표시(`*`)에 `aria-hidden="true"`가 붙어 있어(381행) 스크린리더가 별표를 읽지 않고
  `aria-required={field.required}`(404행)로 필수 여부를 대신 전달한다 — 올바른 패턴.
- **결함 없음.** (EVALUATION.md UX/UI Critic이 이미 별표별로 이 구조를 검증했고, 이번 QA에서
  렌더된 실제 HTML로 코드-실측 일치를 재확인했다.)

## 반응형

"모바일 테스트" 절 참고 — Tailwind 상대 단위/브레이크포인트만 사용, 고정폭(`w-[Npx]` 등) 패턴
0건. 결함 없음.

## 발견된 이슈 (등급별)

이번 QA 라운드에서 **새로 발견한 이슈는 없다**(Critical/High/Medium/Low 전부 0). 아래는
EVALUATION.md 전체를 훑어 취합한, 이 계산기에 **현재 남아있는 미해결 이슈** 목록이다(QA가 새로
만든 게 아니라 기존 Auditor/Critic 보고서에서 아직 해소되지 않은 것만 골랐다):

| 등급 | 항목 | 출처 | 현재 상태 |
|---|---|---|---|
| Low | 초단시간근로자 안내 문구의 "일반적으로 불리한 조정은 아닙니다" | UX/UI Critic 재검증(2026-09-02) | FORMULA.md에 없는 새 해석적 판단이 Optimizer 수정 중 추가됨 — 논리적으로는 방어 가능하나 법령 근거 인용 없음. Formula Analyst 검토 권고. **미해소.** |
| Low | 소정급여일수 표 전체 미노출 | UX/UI Critic 1차 | 구간명("1년 이상 3년 미만" 등)은 보이지만 5×2 표 전체는 화면에 없어 "경계 근접" 비교가 어려움. Optimizer 수정 범위(High 1 + Medium 2 + Low 3)에 포함되지 않아 **미해소로 남아있음**(이번 QA에서 ui.tsx 재확인). |
| Low | 총액 계산 단계(9번째) 설명 보강 여지 | UX/UI Critic 1차 | Optimizer가 명시적으로 이 항목을 다뤘다는 기록은 없다. 다만 이번 QA에서 `buildFormulaSteps` 9번째 스텝의 `legalBasis` 문구가 "구직급여일액(완전정밀도) × 소정급여일수, **최종적으로만 원 단위 절사**"로 이미 갱신되어 있음을 확인했다(반올림 정책 재구현 시 함께 갱신된 것으로 보임) — 소수점이 정수로 바뀌는 이유가 사실상 설명되고 있어 **실질적으로는 해소에 가깝다고 판단**하나, Critic이 별도로 "해소 확인"한 적은 없어 표에는 유지한다. |
| Low | 8시간 표준근로시간 고정 가정을 결과 화면에 명시 안 함 | Calculation Auditor 1차("이미 문서화된 한계") | rates-2026.json/FORMULA.md에는 명시돼 있으나, 이번 QA에서 `ui.tsx`를 grep한 결과 "8시간"/"standardDailyWorkHours" 관련 문구가 결과 화면(정책 안내 섹션 포함)에 전혀 없음을 확인했다 — **미해소.** |
| Low | 시행령 관보(gwanbo.go.kr) 원문 미확인(하한액 66,048원의 1차 출처) | Calculation Auditor 1차 | 산술 재현 + work24.go.kr 실동작 + easylaw.go.kr 산식 인용으로 신뢰도는 충분히 높으나, 관보 원문 열람 자체는 접근 제한으로 실패한 상태 그대로. **미해소(배포 차단 사유 아님).** |
| Medium(해소됨, 기록용) | 구직급여일액 반올림 순서 상충 | Calculation Auditor 1차 → 재검증(7절) | FORMULA.md 정책 갱신 + Builder `finalizeTotalBenefit` 재구현으로 **해소 확인됨**(Node 독립 재계산, epsilon 보정 오탐 위험까지 수학적으로 배제). |
| High(해소됨, 기록용) | 고용보험 가입기간 입력 단위(암산 환산 필요) | UX/UI Critic 1차 → 재검증 | "가입 시작일" 날짜 입력 + 자동 계산으로 전환 — **해소 확인됨**(이번 QA도 `insuredStartDate` 필드가 `type="date"`이고 실시간 미리보기가 정상 동작함을 코드·렌더 HTML로 재확인). |
| Medium(해소됨, 기록용) | `text-zinc-500/400` → `text-muted` 미준수 | UX/UI Critic 1차 → 재검증 | grep 결과 보조 텍스트용 `text-zinc-500/400` 0건 — **해소 확인됨**. |
| Medium(해소됨, 기록용) | 초단시간근로자 안내 카드 정보 나열(행동 지침 부재) | UX/UI Critic 1차 → 재검증 | 두 문장으로 보강되어 주요 지적은 해소됐으나, 그 과정에서 위 신규 Low(근거 없는 해석 문장)가 함께 생겼다. |

**미해소로 남은 항목은 전부 Low 등급 5건**(그중 1건은 사실상 해소에 가깝다고 판단하나 공식
확인 기록이 없어 유지)이며, Critical/High/Medium 미해소 항목은 없다. 계산 정확성·자격 게이팅
로직·접근성 구조에 영향을 주는 항목은 하나도 없다 — 전부 문구 보강/표 노출 같은 UX 개선
권고 수준이다.

## 판정
**PASS**

- Critical 0, High 0, Medium 0, Low 0(이번 QA 라운드 신규 발견 기준).
- `npm test` 102/102, `tsc --noEmit` 오류 0, `next build` 성공, `eslint` 오류 0.
- 서버 기동 후 `/calculators/unemployment-benefit` HTTP 200 확인, draft 상태이므로 홈/sitemap
  미노출은 의도된 정상 동작.
- `validation.ts` 독립 실행으로 빈 입력/음수/0/매우 큰 값/소수/잘못된 문자/날짜 순서 오류 등
  24개 케이스 전부 기대대로 동작, 결함 없음.
- Accessibility(라벨 연결, `role="alert"`, `aria-live`, `aria-describedby`, `aria-hidden`)
  코드·렌더 HTML 이중 확인, 결함 없음.
- 반응형(고정폭 요소 0건, Tailwind 상대 단위·브레이크포인트만 사용) 확인.
- severance-pay 포함 전체 스위트 회귀 없음(102/102 통과에 기존 테스트 전부 포함).
- 남아있는 이슈는 전부 Low 등급(위 표 참고)이며 계산 정확성·자격 판정에는 영향 없음 —
  docs/EVALUATION.md PASS 기준(Critical 0, High 0)을 충족한다.
- **한계 고지**: 이 환경에 실제 브라우저/모바일 디바이스 에뮬레이터가 없어 실제 뷰포트
  스크린샷·브라우저 Console 탭 관찰은 정적 코드 감사로 대체했다(위 "모바일 테스트"/"브라우저
  테스트" 절 참고). 다음 라운드에서 실제 브라우저 확인을 권고하되, 이번 QA의 PASS 판정을
  뒤집을 근거는 찾지 못했다.

---

## v2 재검증 (2026-09-03)

v2(체크박스/이직사유 제거, 문구 간결화)가 Calculation Auditor·UX/UI Critic 재검증 모두
PASS(Critical 0, High 0)한 상태에서 진행한 최종 QA다. 이번에도 Edit 권한 없이 코드를 읽기만
했고, Bash는 포트 정리·빌드·테스트·서버 구동 확인 용도로만 썼다. Write는 이 섹션 추가에만
사용했다(기존 절 보존, 삭제·수정 없음).

### 사전 정리: 포트 3000

`Get-NetTCPConnection -LocalPort 3000 -State Listen`으로 확인한 결과 이전 세션에서 남은 것으로
보이는 `node.exe`(PID 39476)가 떠 있었다. `Stop-Process -Id 39476 -Force`로 종료하고 포트가
비었음을 재확인한 뒤 QA를 시작했다. QA 진행 중 `npm run start`로 서버를 한 차례 띄웠고, 검증
직후 리스닝 PID를 다시 조회해 `Stop-Process -Force`로 정리했다 — QA 종료 시점에 포트 3000은
비어 있다(마지막 확인: `PORT_3000_FREE`).

### 빌드·타입체크·린트·테스트

- `npm run build`(`next build`, Turbopack) — 컴파일·타입체크·정적 페이지 생성까지 전부 성공.
  **v1 QA 때와 달리 이번에는 라우트 표에 `unemployment-benefit`이 `●`(SSG)로 나타난다** —
  `src/calculators/registry.ts` 88~101행을 확인한 결과 `status`가 `"draft"`에서
  `"published"`로 바뀌어 있었다(주석: "Calculation Auditor + UX/UI Critic + QA 전부 통과,
  최종 95점"). 이는 QA가 만든 변경이 아니라 이번 라운드 진입 전에 이미 반영되어 있던 상태이며,
  아래 "발견된 이슈"에 영향 범위를 기록한다.
- `npx tsc --noEmit` — 출력 없음(오류 0).
- `npm run lint`(`eslint`) — 출력 없음(오류 0).
- `npm test`(vitest) — **102/102 통과**(9개 파일), v1 QA와 동일한 스위트 크기·통과 수 — 회귀
  없음. severance-pay 관련 테스트 파일도 전부 포함되어 그린.

### `/calculators/unemployment-benefit` 렌더 확인

`npm run start` 후 `curl`로 실제 서버 렌더 HTML을 받아(`/tmp/ub_v2.html`, 23,948 bytes)
아래를 확인했다.

| 확인 항목 | 결과 |
|---|---|
| HTTP 상태 코드 | **200** |
| `voluntaryLeaveAcknowledged` 문자열 | **0건** |
| `이직사유` 문자열 | **0건** |
| `leaveReasonCategory` 문자열 | **0건** |
| `<select` 태그 | **0건**(이직사유 select 자체가 완전히 사라짐) |
| `type="checkbox"` 개수 | **2건**(아래 참고) |
| `<title>` | `실업급여(구직급여) 계산기 \| 계산기 모음` — 실제 메타데이터(v1 QA는 draft라 빈 메타데이터였음) |

남은 체크박스 2건은 `초단시간근로자입니다`/`장애인입니다`로, SPEC.md v2가 제거 대상으로
지목한 "자기 확인 게이팅 체크박스(`voluntaryLeaveAcknowledged`)"·"이직사유 select"와는 무관한
**별개의 선택 입력 필드**다(4주 평균 소정근로시간 15시간 미만 여부, 장애인 등록 여부 — 계산
로직의 초단시간근로자 기준기간 안내에 실제로 쓰이는 값). 소스(`ui.tsx`, `types.ts`,
`validation.ts`, `logic.ts`)를 grep한 결과 `voluntaryLeaveAcknowledged`·`leaveReasonCategory`
문자열은 "v1에 있었고 v2에서 제거했다"는 취지의 주석에만 남아 있고, 실제 필드 선언·폼
상태·검증 로직 어디에도 없음을 확인했다(`RawUnemploymentBenefitFormInput`,
`UnemploymentBenefitCalcInput` 타입 정의 직접 확인).

### 홈/sitemap 노출 (registry status 변경에 따른 파생 확인)

`status`가 `published`로 바뀐 것을 build 로그에서 우연히 발견해, v1 QA에서 "draft라 미노출"로
기록했던 항목들을 다시 실측했다 — v1과 결과가 달라졌다.

- `/`(홈) HTML에 `unemployment-benefit` 문자열 **1건**(카드 링크) — 이제 노출됨.
- `/sitemap.xml`에 `unemployment-benefit` 문자열 **1건** — 이제 포함됨.

이는 QA가 발견한 "결함"이 아니라 `registry.ts`의 `status` 값이 이번 v2 작업 범위에서
`published`로 바뀐 데 따른 정상적인 파생 결과다(주석에 Auditor+Critic+QA 전부 통과, 95점
근거 명시). 다만 QA 지시서에는 이 상태 전환 자체를 별도로 검증하라는 항목이 없었으므로,
**정보 제공 차원으로만 기록**하고 별도 등급을 매기지 않는다 — 계산 정확성·체크박스/이직사유
제거 검증과는 무관하다.

### severance-pay 회귀

- `npm test` 102/102 전체 통과에 severance-pay 테스트 파일들이 포함되어 있어 로직 레벨 회귀는
  없음을 확인했다.
- 같은 서버에서 `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/calculators/severance-pay`
  → **200**, 응답 크기 32,755 bytes로 정상 렌더 확인 — unemployment-benefit v2 변경이
  severance-pay 페이지 라우팅/렌더에 영향을 주지 않았다.

### 접근성 파생 확인 (체크박스 게이팅 제거에 따른 자연 감소)

- `aria-live="polite"` 개수: 렌더 HTML에서 **2건**(v1은 3건 — 체크박스 게이팅 안내 문구가
  사라지면서 그만큼 줄었고, 나머지 2건(가입기간 자동 계산 미리보기, 결과 영역)은 그대로
  남아 있다). 코드(`ui.tsx` 396행, 499행)와 정확히 일치 — 결함 아님, 게이팅 제거에 따른
  당연한 감소.
- `label[for]` 연결 개수: **4건**(v1은 5건 — 이직사유 select의 라벨이 사라진 만큼 줄었고,
  나머지 4건(이직일·나이·가입시작일·임금)은 그대로 남아 있다). 결함 아님.
- `role="alert"` 오류 메시지 구조(ui.tsx 403행)는 v1과 동일하게 유지됨을 소스에서 확인했다.

### Console Error

`src/calculators/unemployment-benefit/` 전체를 grep한 결과 `console.log`/`console.warn`/
`console.error` 잔재 **0건**(v1과 동일, 회귀 없음).

### 발견된 이슈 (v2, 등급별)

이번 v2 재검증에서 **새로 발견한 결함은 없다**(Critical/High/Medium/Low 전부 0). 위 "홈/sitemap
노출" 절의 `status: published` 전환은 결함이 아니라 의도된 배포 상태 변경으로 판단해 등급을
매기지 않았다. 위쪽 "발견된 이슈 (등급별)" 표의 v1 미해결 Low 5건은 이번 v2 변경 범위(체크박스
게이팅 제거·이직사유 select 제거·문구 간결화) 밖의 항목들이라 재검증 대상이 아니며, 그대로
유지된다(신규 회귀 없음을 위 항목별로 확인했다).

### v2 판정
**PASS**

- Critical 0, High 0, Medium 0, Low 0(v2 재검증 라운드 신규 발견 기준).
- `npm test` 102/102(회귀 없음), `tsc --noEmit` 오류 0, `next build` 성공, `eslint` 오류 0.
- `/calculators/unemployment-benefit` HTTP 200, 렌더 HTML에 `voluntaryLeaveAcknowledged`·
  `이직사유`·`leaveReasonCategory`·`<select` 태그 전부 0건 — 체크박스/이직사유 제거가 실제
  배포 산출물(서버 렌더 HTML)에도 정확히 반영됨을 확인했다.
- severance-pay 페이지(200)·테스트 전체 회귀 없음.
- 접근성 마커(`aria-live` 2건, `label[for]` 4건) 감소분이 게이팅/select 제거와 정확히 일치 —
  의도치 않은 접근성 손실 없음.
- `registry.ts` status가 `published`로 바뀌어 홈/sitemap에 노출되기 시작했으나, 이는 QA 지시
  범위 밖의 정보성 관찰이며 결함으로 분류하지 않았다.
- 포트 3000은 QA 종료 시점에 비어 있다(`PORT_3000_FREE`).
