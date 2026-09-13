# QA: 디데이 계산기 (d-day-calculator)

검토 대상: `src/calculators/d-day-calculator/`(`logic.ts`, `validation.ts`, `formatting.ts`,
`content.ts`, `types.ts`, `ui.tsx` 및 각 `*.test.ts(x)`), `src/lib/date-calc.ts`(이번 라운드
신규 추가된 `addDaysUtc`/`weekdayUtc`/`formatIsoDateUtc`), `src/calculators/registry.ts`(등록
상태 `draft`, 아이콘 `calendar`). Builder(자체 확인) → Calculation Auditor(PASS, 독립 Python
재계산 + Zeller's Congruence 수동검증 + 8,000회 fuzz) → UX/UI Critic(PASS, Medium 1건·Low 2건)
완료 후 QA 진행. Edit/Write 권한이 코드에는 전혀 없어 소스 코드를 한 글자도 수정하지 않았다.

## 검증 방법 요약

- 사전 문서 확인: `tasks/d-day-calculator/{SPEC,FORMULA,EVALUATION}.md` 전문, `docs/DESIGN_SYSTEM.md`,
  `docs/EVALUATION.md`. 계산 정확성(Auditor PASS)은 전제로 삼고 재검증하지 않았다 — 이번 QA는
  실사용 흐름(타이핑 → 계산 → 결과)과 기능/모바일/브라우저/입력검증/접근성, 그리고 UX/UI
  Critic이 남긴 Medium 1건·Low 2건의 재현 여부·독립 등급 판정에 집중했다.
- **이번 QA는 실제 헤드리스 브라우저(Chrome, Edge)로 진짜 타이핑→클릭→렌더 결과를 확인했다**
  (이전 라운드들의 QA.md가 기록한 "GUI 브라우저 자동화 도구 부재" 한계를 이번에는 이 환경에
  실제로 설치돼 있던 `chrome.exe`/`msedge.exe`(Playwright/Puppeteer 같은 패키지 의존성 없이)와
  Node 24 내장 `WebSocket`으로 직접 만든 최소 Chrome DevTools Protocol(CDP) 클라이언트로
  극복했다). 방법:
  1. `node_modules/.bin`에 Playwright/Puppeteer가 없음을 먼저 확인했다(기존 관례와 동일).
     대신 `C:\Program Files\Google\Chrome\Application\chrome.exe`,
     `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`가 이 머신에 설치돼 있음을
     확인하고, **반드시 `--user-data-dir`로 세션 전용 임시 프로필**(스크래치패드 하위)을
     지정해 브라우저를 띄웠다 — `--user-data-dir` 없이 실행하면 Chrome의 싱글턴 메커니즘이
     새 프로세스를 사용자의 실제 실행 중인 브라우저에 새 탭으로 병합해 버리는 것을
     처음에 직접 겪었고(그 상태로 찍은 스크린샷은 실제 320px 렌더가 아니라 사용자 브라우저
     창의 실제 폭(500px 등)이었음을 `Runtime.evaluate`로 확인해 즉시 폐기했다), 이후 전용
     프로필 디렉터리를 지정해 완전히 격리된 헤드리스 인스턴스로 재시도해 문제를 해결했다.
     이 과정에서 사용자의 실제 브라우저에 실수로 연 탭 1개를 CDP `Target.closeTarget`으로
     즉시 닫아 원상 복구했다(사용자의 실제 브라우징 세션에 영향 없음, 헤드리스 프로세스라
     화면에 노출되지도 않았다).
  2. 이미 실행 중이던 dev 서버(`http://localhost:3000`, 다른 세션이 띄워 둔 것을 그대로
     재사용 — `curl`로 200 확인 후 사용, 새로 띄우지 않음)에 대해, Node 스크립트
     (`cdp.mjs` — 최소 JSON-RPC-over-WebSocket 클라이언트, `Emulation.setDeviceMetricsOverride`/
     `Page.navigate`/`Runtime.evaluate`/`Page.captureScreenshot`/`Input.dispatchKeyEvent` 래핑)로
     **320/375/390/768/1440px 각 뷰포트에서 실제 페이지를 렌더링**하고, 네이티브 `<input
     type=date>`/라디오/버튼에 실제 값 설정·클릭·키보드 이벤트를 발생시켜 이 작업 지시의
     8개 핵심 시나리오와 표준 QA 항목을 실제 DOM 결과값으로 검증했다(단언 21+6건, 모두 코드
     아님 — 스크립트는 전부 세션 스크래치패드에만 존재하고 프로젝트 소스 트리에는 어떤 파일도
     쓰지 않았다. `ls src/calculators/d-day-calculator/`로 확인 결과 QA 시작 전과 파일 목록이
     정확히 동일함).
  3. 검증에 사용한 임시 스크립트(`cdp.mjs`, `check-responsive.mjs`, `functional-test.mjs`,
     `functional-test2.mjs`, `fullpage.mjs`)와 스크린샷은 모두
     `C:\Users\isnan\AppData\Local\Temp\claude\...\scratchpad\`(세션 전용, 프로젝트 밖)에만
     저장했다. 테스트에 쓴 헤드리스 Chrome/Edge 프로세스는 작업 종료 시 실행한 PID만 정확히
     `taskkill`로 종료해 디버그 포트를 모두 닫았고, dev 서버(`localhost:3000`)는 계속 정상
     응답함을 재확인했다(사용자/다른 세션의 서버에 영향 없음).
  4. Firefox/Safari는 이 Windows 머신에 설치돼 있지 않아 검증하지 못했다(Chrome·Edge 모두
     Chromium 계열이라 완전히 독립적인 렌더링 엔진 검증은 아니다 — 아래 "도구 한계" 참고).
- 회귀 스위트: `npx vitest run`(전체), `npx tsc --noEmit`, `npm run build`.

## 기능 테스트 (작업 지시 8개 핵심 시나리오 — 전부 실제 브라우저 타이핑→계산→렌더로 재현)

모든 시나리오는 실제 Chrome 헤드리스 인스턴스에서 네이티브 이벤트(`input`/`click`, React
controlled input의 네이티브 value setter 트릭 사용)로 재현했고, 렌더된 DOM 텍스트를 직접
읽어 기대값과 대조했다. Edge에서도 핵심 시나리오 세트(1~8 요약)를 동일하게 재실행해 결과가
일치함을 재확인했다.

1. **모드 A 정방향**: 시작일 기본값(오늘, 2026-09-12) 유지 → 목표일 `2026-12-25` 입력 →
   계산 → 결과 `D-104`, 문장 "2026년 12월 25일까지 104일 남았습니다." 정확히 렌더링됨
   (FORMULA.md Golden Test #4·SPEC.md 예시 문장과 일치). **문제없음.**
2. **모드 A 역방향**: 시작일을 `2026-09-20`으로 변경(오늘이 아닌 미래) → 목표일을 시작일보다
   과거인 `2026-09-11`로 입력 → 계산 → `D+9` 정확히 렌더링(선후관계 제약 없이 정상 계산됨을
   실제 UI로 확인). **문제없음.**
3. **시작일=목표일 → D-Day**: 양쪽 모두 `2026-09-12` 입력 → 계산 → `D-Day` 표시, 화면에
   `role="alert"` 요소가 0개(오류로 취급되지 않음), 결과 카드 클래스에 `bg-primary`(강조 색)가
   포함되고 경고색(`bg-warning-surface`/`text-danger`)은 전혀 없음을 실제 렌더된 DOM
   `className`으로 확인 — 코드 레벨로만 확인했던 Critic Q10과 달리 실제 화면에서도 오류처럼
   보이지 않음을 재확인했다. **문제없음.**
4. **모드 B 더하기/빼기, 일수=0**: 기준일 기본값(오늘) 유지, 일수 `0`, 방향 `더하기` → 계산 →
   결과 `2026년 9월 12일 (토)`(기준일과 동일 날짜) 정상 렌더, `role="alert"` 0개(오류
   아님). 이어서 방향을 `빼기`로 바꾸고 일수 `10` → 결과 `2026년 9월 2일 (수)` 정확히
   렌더링(2026-09-12 − 10일 = 2026-09-02, 실제 요일 계산까지 일치). **문제없음.**
5. **모드 A ↔ 모드 B 역함수(실제 UI 흐름)**: 모드 B에서 기준일(오늘)+일수 `104`·`더하기` 계산 →
   결과 `2026년 12월 25일 (금)` 렌더 확인 → 모드 A로 전환해 목표일에 그 결과 날짜
   `2026-12-25`를 그대로 입력 → 계산 → `D-104` 정확히 렌더링됨을 확인했다 — Auditor는 로직
   함수만 8,000회 fuzz했지만, 이번에 처음으로 **실제 화면 전환(라디오 클릭)까지 포함한
   엔드투엔드 흐름**으로 같은 불변식을 검증했다. **문제없음.**
6. **경계값(전부 실제 폼 입력으로 재현)**:
   - 윤년: 시작일 `2024-02-28`, 목표일 `2024-03-01` → `D-2` 정확히 렌더링.
   - 존재하지 않는 날짜(`2024-02-30`): 네이티브 `<input type="date">`의 값 설정 자체가
     **브라우저 레벨에서 거부**되어 `value`가 빈 문자열로 남는 것을 실측 확인했다(즉 이
     계산기의 `validation.ts`/`logic.ts`가 걸러내기 이전에 브라우저 자체가 1차 방어선
     역할을 한다 — 이는 코드 정독만으로는 알 수 없는, 실제 브라우저 테스트로만 확인 가능한
     사실이다). 그 상태로 계산 버튼을 누르면 "목표일을 입력해 주세요."(빈 값 오류)가
     `role="alert"`로 정확히 표시됨.
   - 지원 범위 밖(`1899-12-31`, `2201-01-01`): 둘 다 "목표일은 1900-01-01부터
     2200-12-31까지만 입력할 수 있습니다." 오류가 정확히 표시되고 계산되지 않음(네이티브
     `min`/`max` 속성은 힌트일 뿐 값 자체를 막지 않으므로, 애플리케이션 레벨 검증이 실제로
     동작함을 확인).
   - `days` 상한 초과(`100001`): "일수는 100,000일까지 입력할 수 있습니다." 오류 정확히
     표시.
   - **Golden Test #23 실제 폼 재현**: 기준일 `2000-01-01`, 일수 `100000`, 방향 `더하기` →
     계산 → 오류 "계산된 날짜(2273-10-16)가 지원 범위(1900-01-01~2200-12-31)를
     벗어났습니다. 기준일 또는 일수를 다시 확인해 주세요."가 정확히 표시되고 결과 카드
     (`계산된 날짜` 헤딩) 자체가 렌더링되지 않음을 확인했다 — 상한 통과 + 결과 범위 초과
     조합이 실제 UI에서도 정확히 거부됨.
   모든 경계값 케이스 **문제없음.**
7. **모드 전환 상태 보존(실제 상호작용)**: 모드 A 계산 → 모드 B로 전환(결과 없음 확인) →
   모드 B 계산 → 모드 A로 복귀 → 이전 `D-Day` 결과가 그대로 남아있음을 실제 렌더로 재확인
   (기존 `ui.test.tsx`와 동일 결론이나, 이번엔 실제 브라우저 클릭 이벤트로 재검증).
   **문제없음.**
8. **"오늘" 배지**: 시작일을 오늘 그대로 두고 계산 → `오늘` 배지 텍스트 존재 확인. 시작일을
   `2020-01-01`로 바꾸고 계산 → `오늘` 배지 텍스트 없음을 확인. **문제없음.**

추가로 확인한 기능:
- **FAQ 아코디언**: 실제 클릭으로 `aria-expanded`가 `false→true`로 토글됨을 확인.
- **SEO 구조화 데이터**: SSR HTML에 `WebApplication`·`FAQPage`·`Question`·`Answer` 타입의
  JSON-LD가 모두 포함됨을 `curl`로 확인(SPEC.md Must Have).
- **registry 등록**: `slug: "d-day-calculator"`, `title: "디데이 계산기"`, `category: "date"`,
  `icon: "calendar"`, `status: "draft"` — SPEC.md와 정확히 일치.

## 모바일 테스트 (320 / 375 / 390 / 768 / 1440px)

**실제 헤드리스 Chrome/Edge에서 `Emulation.setDeviceMetricsOverride`로 정확한 뷰포트 폭을
강제하고, `document.documentElement.scrollWidth`와 `clientWidth`를 직접 비교해 가로 스크롤
여부를 실측했다**(코드 치수 추정이 아니라 실제 렌더 결과 측정 — 이전 QA.md 선례들의
"코드 정적 분석" 한계를 이번에는 도구로 극복했다).

| 폭 | 모드 A(결과 있음) | 모드 B | 비고 |
|---|---|---|---|
| 320px | `scrollWidth=clientWidth=320` (overflow 없음) | 동일 | Chrome·Edge 둘 다 동일 |
| 375px | 동일(overflow 없음) | 동일 | |
| 390px | 동일(overflow 없음) | 동일 | |
| 768px | 동일(overflow 없음) | 동일 | |
| 1440px | 동일(overflow 없음) | 동일 | |

- **UX/UI Critic Low #1 재현 시도(320px "날짜 입력 + 오늘로 버튼" 인접 배치 잘림 위험, 작업
  지시 핵심 확인 대상) — 실측 결과 재현되지 않음**: `getBoundingClientRect()`로 실제 렌더
  치수를 측정한 결과, 320px 폭에서 시작일/기준일 `<input type="date">`는 **170.875px**,
  "오늘로" 버튼은 **59.125px**(둘 다 같은 행, `sameRow=true`), 버튼 오른쪽 끝은
  뷰포트 기준 279px로 320px 안에 완전히 들어간다. 375px에서는 입력 225.875px, 390px에서는
  240.875px로 폭 여유가 더 커진다. 320px 스크린샷에서도 `2026-09-12`(연-월-일 세 서브필드)가
  전부 잘림 없이 표시됨을 시각적으로 확인했다. **Chrome·Edge 두 엔진 모두에서 동일하게
  재현되지 않았다.**
- **QA 독립 판단**: Critic의 우려(320px에서 네이티브 date 위젯의 브라우저별 최소 렌더 폭이
  버튼과 충돌할 수 있다)는 코드 정독만으로는 검증 불가능했던 합리적 가설이었으나, 이번에
  실제 두 Chromium 계열 브라우저로 측정한 결과 실제 위험은 확인되지 않았다. 다만 **Safari(모바일
  포함)와 Firefox는 이 환경에 설치돼 있지 않아 검증하지 못했다** — Safari의 네이티브 date
  입력 위젯은 Chromium과 렌더링 방식이 달라(iOS Safari는 탭 시 전체 화면 휠 피커를 띄우는
  방식이라 인라인 폭 자체는 오히려 이슈가 적을 가능성이 높지만) 완전히 배제할 수는 없다.
  등급을 **Low → "Chrome/Edge에서 재현되지 않음, 잔여 위험은 Low로 하향 유지"**로 독립
  판정한다(원래 Critic의 Low보다 신뢰도 높은 실측 근거로 위험이 낮아졌음을 확인했지만, 미검증
  엔진이 남아 완전히 "문제없음"으로 해제하지는 않는다).
- **768px/1440px**: 모드 B "일수·방향" 2열 그리드(`sm:grid-cols-2`)가 정상적으로 나란히
  배치되고, 공유 버튼 4개(`X`/카카오톡/링크 복사/다른 앱)도 한 줄에 모두 들어감을 스크린샷으로
  확인했다. **문제없음.**
- **375px에서 모드 B 그리드 단일 열 전환**: 640px 미만이라 "일수"/"방향"이 세로로 쌓이지만
  둘 다 잘림 없이 전체 폭을 사용해 렌더링됨을 스크린샷으로 확인했다. **문제없음.**

## 브라우저 테스트

- **실제 헤드리스 Chrome**(153.0.8010.36)과 **Edge**(152.0.4191.66, Chromium 기반) 두
  브라우저에서 동일한 기능 시나리오 세트(전체 21개 단언)를 재실행해 **둘 다 전부 PASS**했다
  (이전 QA.md 선례들이 "GUI 브라우저 없음"으로 코드 분석에 그쳤던 것과 달리, 이번엔 실제 두
  독립 브라우저 실행 파일로 실제 렌더·실제 이벤트를 확인했다).
- 사용 API: 네이티브 `<input type="date">`(값 검증·`min`/`max` 힌트), `Intl.DateTimeFormat`
  (`todayInKorea`, Asia/Seoul 기준 오늘 날짜), `URL`/`URLSearchParams`/`btoa`/`atob`(공용
  `src/lib/share.ts`, 이번 계산기가 수정하지 않음), `navigator.clipboard`(공용
  `ShareActions.tsx`) — 전부 최신 evergreen 브라우저 표준 지원 범위.
- **키보드 네이티브 라디오 그룹 동작 실측(작업 지시 "라디오 그룹 시맨틱" 확인)**: 모드 탭의
  첫 라디오(`디데이 계산`)에 포커스를 준 뒤 실제 `Input.dispatchKeyEvent`로 `ArrowRight`
  키를 전송한 결과, 포커스가 `dateShift` 라디오로 이동하고 **동시에 `checked` 상태도
  `dateShift`로 전환**되며 화면도 실제로 "날짜 계산" 모드(기준일 필드 노출)로 전환됨을
  확인했다 — 이는 코드에 `<input type="radio">`가 있다는 사실 확인을 넘어, 실제 브라우저의
  네이티브 라디오 그룹 키보드 동작(Tab 진입 후 방향키 이동)이 이 특정 마크업에서 정확히
  작동함을 실측으로 검증한 것이다(Critic Q9는 코드 구조만 확인했음). **문제없음.**
- Turbopack 프로덕션 빌드(`npm run build`) 성공, `npx tsc --noEmit` 오류 0건.
- **Firefox/Safari(특히 모바일 Safari)는 이 Windows 환경에 설치돼 있지 않아 검증하지
  못했다** — 아래 "도구 한계" 참고.

## 입력 검증

- **빈 입력**: 모드 A에서 아무 입력 없이 계산 → "목표일을 입력해 주세요." 오류(시작일은
  기본값이 있어 항상 채워짐). 모드 B에서 일수 비움 → "일수를 입력해 주세요." (기존
  `ui.test.tsx` + 본 QA 실브라우저 재확인). **문제없음.**
- **음수**: 일수 입력 필드는 `onChange`에서 `event.target.value.replace(/\D/g, "")`로 숫자
  이외 문자를 실시간 제거한다(`ui.tsx` `handleShiftDaysChange`) — `-` 기호 자체가 입력 값에
  남을 수 없어 **음수를 입력 필드에 남길 방법이 없다**(코드 확인). 방향은 별도 라디오
  (더하기/빼기)로만 조절하므로 SPEC.md 요건과 일치. **문제없음.**
- **0**: 모드 B 일수 `0` → 정상 결과(위 "기능 테스트" 시나리오 4). 모드 A 시작일=목표일도
  동일 성격(시나리오 3). **문제없음(둘 다 오류 아님으로 정확히 처리).**
- **매우 큰 값**: 일수 `100001`(상한+1) → "일수는 100,000일까지 입력할 수 있습니다." 오류.
  날짜 자체의 "매우 큰 값"은 지원 범위 밖 날짜(`2201-01-01`)로 확인(위 경계값 시나리오).
  **문제없음.**
- **소수**: 일수 필드는 `\D` 정규식이 `.`도 제거하므로 소수점 자체를 입력 필드에 남길 수
  없다(코드 확인, `handleShiftDaysChange`). 날짜 필드는 네이티브 date 위젯이라 소수 개념이
  없다. **문제없음(소수 입력 자체가 UI 레벨에서 원천 차단됨).**
- **잘못된 문자**: 일수 필드에 문자를 입력해도 `\D` 제거로 숫자만 남는다(실제 타이핑 이벤트로
  `handleShiftDaysChange`의 `event.target.value.replace(/\D/g, "")` 경로가 실행됨을 코드로
  확인 — average-cost-calculator의 `normalizeDecimalDisplay`와 동일한 성격의 실시간 정규화).
  날짜 필드에 잘못된 날짜(`2024-02-30`)를 넣으면 위에서 확인했듯 네이티브 위젯이 값 자체를
  거부한다. **문제없음.**

## Copy / Reset

- **Reset(초기화)**: 시작일을 `2020-05-05`로 바꾸고 목표일 `2026-12-25`로 계산 후 "초기화"
  클릭 → 시작일이 오늘로 복귀, 목표일이 빈 값으로 복귀, 결과 영역(`디데이` 헤딩) 사라짐을
  실제 DOM 값으로 확인. **문제없음.**
- **Copy(링크 복사)**: 공유 영역에 "링크 복사" 버튼이 실제로 렌더링됨을 확인했다. 실제
  클립보드 쓰기(`navigator.clipboard.writeText`)는 **헤드리스 브라우저의 "문서가 포커스되지
  않음(Document is not focused)" 제약으로 실제 클립보드 내용까지는 검증하지 못했다**(OS
  레벨 창 포커스가 없는 헤드리스 환경의 근본적 한계 — 실제 사용자 클릭은 신뢰된 제스처로
  포커스가 있는 상태에서 발생하므로 프로덕션에서는 발생하지 않는 제약이다). 이 계산기는
  `ShareActions.tsx`(공용 컴포넌트, 수정 대상 아님)를 그대로 사용하며 다른 계산기 QA에서
  이미 같은 컴포넌트의 폴백 동작(`execCommand('copy')`)이 검증된 바 있다. **기능 코드 자체는
  문제없음, 클립보드 실제 쓰기 검증은 도구 한계로 미완(아래 "도구 한계" 참고).**

## Console Error

- **실제 헤드리스 브라우저 콘솔을 CDP `Runtime.consoleAPICalled`/`Runtime.exceptionThrown`
  이벤트로 직접 구독**해 초기 페이지 로드(하이드레이션 포함) 시점의 메시지를 확인한 결과,
  `[HMR] connected`와 React DevTools 안내(dev 모드 고유 정보성 메시지) 외에 어떤 오류·경고도
  없었다.
- 이어서 `console.error`/`console.warn`을 오버라이드하는 훅을 설치한 뒤 **모드 A 전체 흐름
  (샘플 채우기→계산→초기화) + 모드 B 전체 흐름(전환→샘플→계산→초기화) + FAQ 토글 + 공유 버튼
  클릭**까지 이어지는 실사용 흐름 전체에서 `console.error`/`console.warn` 호출 **0건**을
  확인했다.
- 이미 실행 중이던 dev 서버의 로그 파일(`.next/dev/logs/next-development.log`)을 확인한
  결과, 이번 QA 세션 동안의 다수 네비게이션·상호작용 기록에도 React DevTools 안내 외의
  오류·경고가 전혀 없었다.
- `npx tsc --noEmit`: 오류 0건. `npm run build`: 경고 없이 성공.

## Accessibility

- **label 연결**: 실제 렌더된 DOM에서 시작일/목표일 `<input id="...">`와 대응하는
  `<label for="...">`가 각각 존재함을 `document.querySelector('label[for="' + el.id + '"]')`로
  실측 확인(`hasLabel: true` × 2).
- **오류 = role="alert" + aria-describedby + aria-invalid 연결**: 목표일을 비운 채 계산해
  오류를 발생시킨 뒤, 목표일 입력의 `aria-describedby`가 가리키는 요소가 실제로
  `role="alert"`이고 텍스트가 "목표일을 입력해 주세요."임을, 그리고 `aria-invalid="true"`가
  동시에 설정됨을 실제 DOM에서 확인했다.
- **aria-live**: 실제 렌더에서 `[aria-live="polite"]` 요소 2개(결과 영역 + `ShareActions`
  피드백 문구) 확인.
- **FAQ 아코디언**: 실제 클릭으로 `aria-expanded`가 `false → true`로 바뀜을 확인(공용
  `FaqAccordion`, 이 계산기가 수정하지 않음).
- **키보드 포커스 순서**: 실제 포커스 가능 요소를 순서대로 나열한 결과 `홈 링크 → 테마 토글
  → 모드 라디오 2개 → 시작일 입력 → 오늘로 버튼 → 목표일 입력 → 계산 버튼(submit) → 초기화
  → 샘플 값 채우기 → 공유 버튼들` 순으로, 논리적인 시각적 순서와 일치한다. **문제없음.**
- **네이티브 라디오 그룹 키보드 조작(작업 지시 "라디오 그룹 시맨틱" 확인)**: 위 "브라우저
  테스트" 절에서 실제 `ArrowRight` 키 이벤트로 검증 — 포커스 이동과 `checked` 상태 전환,
  화면 갱신까지 모두 정상 작동. **문제없음.**
- `:focus-visible` 전역 스타일 제거 코드가 이 계산기에 없음을 코드로 확인(Critic과 동일
  결론, 재확인).

## UX/UI Critic Medium 1건·Low 2건 — QA 재현 및 독립 등급 판정

### 1) [Medium] 모드 B "방향"(더하기/빼기) 라디오 토글이 색상만으로 선택 상태를 구분

- **재현 여부**: **실제 렌더로 재현됨.** 실제 DOM에서 두 라디오를 감싸는 `<label>`의
  `className`을 직접 읽은 결과 — 선택됨: `border-primary bg-primary-soft text-primary`,
  선택 안 됨: `border-border bg-background text-muted hover:border-border-strong`이며, 두
  라벨 모두 `hasSvg: false`(체크 아이콘·다른 그래픽 요소 전혀 없음)임을 확인했다. 320~1440px
  스크린샷에서도 "더하기"/"빼기" 버튼이 테두리·배경·글자 색만 다를 뿐 다른 시각적 신호
  (굵기, 밑줄, 아이콘)가 전혀 없음을 육안으로도 확인했다.
- **QA 독립 판단**: **Medium 유지(Critic과 동일 등급)**. SPEC.md Must Have("색상만으로 선택
  상태를 구분하지 않는다")를 문자 그대로 위반하는 구체적 지점임을 실제 렌더로 재확인했다.
  다만 실제 네이티브 `<input type="radio" checked>` 시맨틱은 정상 작동함을 이번 QA가
  `ArrowRight` 키보드 테스트로 실측했으므로(위 "Accessibility" 절), 스크린리더 사용자는
  `aria`/`checked` 상태로 정확한 선택 상태를 알 수 있어 **기능 차단은 없다**는 Critic의
  판단에도 동의한다. 색맹·저시력 사용자 중 스크린리더를 쓰지 않는 경우에는 여전히 시각적
  구분이 약하므로, Critical/High(잘못된 계산·핵심 기능 마비)에는 해당하지 않고 Medium이
  타당하다고 독립적으로도 결론짓는다.

### 2) [Low] "날짜 입력 + 오늘로 버튼" 인접 배치의 320px 잘림 위험

- 위 "모바일 테스트" 절에서 실측한 대로 **Chrome·Edge 두 브라우저에서 재현되지 않았다**
  (320px에서 입력 170.875px + 버튼 59.125px, 같은 행에 여유 있게 배치, `scrollWidth ===
  clientWidth`).
- **QA 독립 판단**: Low → 실측 결과 위험이 확인되지 않아 등급을 하향할 근거가 있지만, 이
  환경에 Safari/Firefox가 없어 완전히 배제하지는 못한다. **Low로 유지하되, "재현되지 않음"을
  명시적으로 기록**한다(Critic이 가설로만 남겼던 것을 QA가 실측으로 검증했다는 점에서 진전이
  있다).

### 3) [Low] 모드 B "오늘 기준 D-Day" 보조 배지가 설명 문장 없이 노출

- **재현 여부**: **실제 렌더로 재현됨.** 모드 B에서 계산 후 핵심 결과 카드 안에 "오늘 기준
  D-104"(문장형 설명 없이 `ddayLabel` 원시 값만) 형태로 표시됨을 스크린샷 및 텍스트 검사로
  확인했다. 바로 위에는 이미 "2026년 9월 12일에서 104일을 더한 날짜는 2026년 12월 25일
  (금)입니다."라는 완전한 문장이 있어 핵심 정보 전달 자체에는 지장이 없다.
- **QA 독립 판단**: **Low 유지(Critic과 동일 등급)**. 모드 A에서는 D-표기에 항상 문장을
  동반시키는 원칙이 있는데 모드 B의 이 보조 배지에서만 예외라는 일관성 지적에 동의하며,
  기능·과업 완수를 막는 요소가 아니므로 Critical/High는 아니다.

## 반응형

`docs/DESIGN_SYSTEM.md` "모바일" 절 요건(입력 필드 잘림 없음, 숫자 키패드, 결과 한눈에 보임,
가로 스크롤 없음)을 320/375/390/768/1440px **실제 헤드리스 브라우저 렌더 + 실측
`scrollWidth`/`clientWidth` 비교**로 확인했다. 5개 브레이크포인트, 모드 A(입력만·결과 있음)·
모드 B 총 15개 조합 전부 가로 스크롤 없음을 확인했다. 일수 입력에는 `inputMode="numeric"`이
설정돼 있어 모바일에서 숫자 키패드가 뜬다(코드 확인, 실제 모바일 OS 키패드 노출 자체는
아래 "도구 한계" 참고).

## 회귀 테스트

- `npx vitest run`(전체 스위트): **74개 파일, 922개 테스트 전부 통과**(Builder/Auditor 보고와
  동일 수치 — 기존 계산기 회귀 없음, 이번 라운드가 수정한 `src/lib/date-calc.ts`를 사용하는
  `unemployment-benefit`/`severance-pay`/`housing-subscription-score` 포함).
- `npx tsc --noEmit`: 오류 0건.
- `npm run build`: Next.js 16.3.4(Turbopack) 프로덕션 빌드 성공, 21개 정적 페이지 생성
  (`d-day-calculator`는 `status: "draft"`라 `generateStaticParams` SSG 목록에는 없지만 동적
  라우팅으로 정상 200 응답, `curl`로 재확인).
- 이번 QA는 소스 코드를 전혀 수정하지 않았고(Edit/Write 권한 없음), 검증에 사용한 모든 임시
  스크립트·스크린샷은 프로젝트 밖 세션 스크래치패드에만 존재한다 —
  `ls src/calculators/d-day-calculator/`로 QA 시작 전과 파일 목록이 정확히 동일함을 재확인했다.

## 도구 한계로 검증하지 못한 항목 (명시적 기록)

- **Firefox/Safari(특히 모바일 Safari)**: 이 Windows 환경에 설치돼 있지 않아 실제 렌더링을
  확인하지 못했다. Chrome·Edge는 모두 Chromium 엔진이라 완전히 독립적인 두 렌더링 엔진
  검증은 아니다 — 특히 네이티브 `<input type="date">`의 브라우저별 위젯 폭·모바일 OS 날짜
  피커 동작은 Safari/Firefox에서 다를 수 있다.
- **클립보드 실제 쓰기 확인**: 헤드리스 브라우저의 "문서 포커스 없음" 제약으로
  `navigator.clipboard.writeText` 실제 성공 여부까지는 확인하지 못했다(실제 사용자 클릭
  환경에서는 발생하지 않는 헤드리스 특유의 제약).
- **실제 모바일 기기의 숫자 키패드 노출 여부**: `inputMode="numeric"` 설정은 코드로
  확인했으나, 실제 iOS/Android 기기에서 키패드가 올바르게 뜨는지는 실기기가 없어 확인하지
  못했다.
- **다크모드 실제 렌더링**: 코드상 `dark:` 유틸리티 클래스만 쓰고 임의 hex 값이 없음을
  확인했으나(코드 확인), 다크모드 토글 상태의 실제 스크린샷 검증은 이번 QA 범위에서
  수행하지 않았다.

## 발견된 이슈 (등급별)

| 등급 | 개수 | 내용 |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 1 | Q8(UX Critic): 모드 B "방향"(더하기/빼기) 라디오 토글의 선택 상태가 테두리·배경·글자 색상 변화만으로 구분됨(`ui.tsx` 방향 토글 블록). 실제 렌더·className 실측으로 재현 확인, 등급 유지. 스크린리더는 네이티브 라디오 시맨틱(`ArrowRight` 키보드 테스트로 실측 확인)으로 정상 인식해 기능 차단은 아님. |
| Low | 2 | 1) Q15(UX Critic): 모드 B "오늘 기준 D-Day" 보조 배지가 설명 문장 없이 원시 라벨만 노출 — 실제 렌더로 재현 확인, 등급 유지(기능 지장 없음). 2) [QA 신규] Firefox/Safari 미검증 + 클립보드 실제 쓰기 헤드리스 제약 — 도구 한계로 인한 잔여 불확실성(제품 결함 아님, 참고 기록). |

**참고**: UX/UI Critic Low #1("날짜 입력+오늘로 버튼" 320px 잘림 위험)은 이번 QA의 실측
결과 Chrome·Edge 두 브라우저에서 **재현되지 않았다**(위 "모바일 테스트"·"UX/UI Critic 재현"
절 참고) — 위 표에 별도 결함으로 집계하지 않았다.

## 판정

**PASS**

- Critical 0, High 0 — `docs/EVALUATION.md` PASS 기준을 위반하는 이슈가 없다. 계산 정확성은
  Calculation Auditor가 이미 독립 Python 재계산·Zeller's Congruence 수동검증·8,000회 fuzz로
  PASS 판정했고, 이번 QA는 그 결과가 실제 브라우저 타이핑→계산→결과 흐름(8개 핵심 시나리오,
  경계값 6종, Golden Test #23 포함)에서 화면에 정확히 표시됨을 실측으로 추가 확인했다.
- 전체 회귀 스위트 922/922 통과, TypeScript 오류 0, 빌드 성공.
- Console Error/Warning 0회(실제 헤드리스 브라우저 콘솔 이벤트 구독 + 전체 상호작용 흐름
  훅 기록 둘 다로 확인).
- Mobile Critical Issue 0 — 320~1440px 5개 브레이크포인트에서 실측 가로 스크롤 없음(Critic이
  가설로 남긴 Low 위험도 실측으로 재현되지 않음을 확인).
- UX/UI Critic의 Medium 1건·Low 2건 모두 재현 여부를 실제 렌더로 직접 확인했고, Medium 1건과
  Low 1건은 등급을 그대로 유지, Low 1건("날짜 입력+오늘로 버튼" 320px 위험)은 실측 결과
  재현되지 않음을 확인해 결함 목록에서 제외했다. 이 세 건 모두 계산 정확성과는 무관하며,
  Medium 1건(방향 토글 비-색상 신호 추가)은 Optimizer가 다음 라운드에서 반영할 것을
  권장한다 — Medium 등급이므로 이번 QA 라운드를 FAIL로 만드는 사유는 아니다.

## 재검증 (Optimizer 수정 후)

`tasks/d-day-calculator/EVALUATION.md` "## Optimizer" 절(대상: 위 Medium 1건·Low 1건)을
읽은 뒤, `ui.tsx` diff를 코드로 직접 확인하고 격리된 헤드리스 Chrome(전용
`--user-data-dir=...scratchpad\qa-profile`, 포트 9333, 사용자 실제 브라우저와 완전 분리,
검증 후 PID로만 종료해 `qa-profile` 프로세스 0개 확인)으로 CDP 재검증했다.

1. **[Medium] 방향 토글 체크마크 — 해결(Resolved)**: 실제 DOM에서 `checked=true`인 라디오
   (`add`/`subtract` 각각 확인)에만 `<svg aria-hidden="true">`(경로 `M5 13l4 4L19 7`)가
   존재하고, 미선택 쪽은 `hasSvgSibling: false`임을 확인. `focus()` 후 `ArrowRight` CDP 키
   이벤트를 보내자 포커스·`checked`·체크 아이콘이 `add→subtract`로 **동시에** 이동해, 이전
   라운드에 검증한 라디오 시맨틱(Tab 진입, 방향키 이동)이 마크업 변경 후에도 그대로
   유지됨을 확인했다(레이아웃 변경이 라디오 그룹을 깨지 않음). 스크린샷으로 "빼기"에만
   체크(✓)가 표시되고 "더하기"는 텍스트만 있음을 육안으로도 확인. 색상 신호에 독립적인
   비-색상 신호(아이콘)가 실제로 추가돼 원래 Medium 사유가 해소됨을 확인했다. **등급:
   Medium → 해결.**
2. **[Low] "오늘 기준" 배지 문장 — 해결(Resolved)**: 모드 B(기준일=오늘, 일수=104, 더하기)
   계산 후 배지가 `오늘 기준 D-104 · 2026년 12월 25일까지 104일 남았습니다.`로 렌더링됨을
   텍스트·스크린샷 둘 다로 확인 — 라벨 단독 노출이던 기존 문제가 실제로 해소됐다. **등급:
   Low → 해결.**
- 상호작용 전체에서 `console.error`/`warning`/`exception` 0건.
- 회귀: `npx vitest run` 74파일/922테스트 전부 통과(수정 전과 동일 수치), `npx tsc --noEmit`
  오류 0건, `npm run build` 성공. 소스 트리는 코드로만 확인했고 QA는 한 글자도 수정하지
  않았다.

**전체 재검증 판정: PASS** — 지시된 2건 모두 실제 렌더로 해결 확인, 회귀 없음, 새로 발생한
Critical/High/Medium/Low 없음.
