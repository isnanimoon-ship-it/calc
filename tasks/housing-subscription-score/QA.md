# QA: 청약가점 계산기

QA 시점: 2026-09-06. Calculation Auditor(최종 PASS), UX/UI Critic(재검증 PASS) 완료 이후
단계. 대상: `src/calculators/housing-subscription-score/` 전체(`ui.tsx` 메인 화면),
공용 인프라(`src/lib/date-calc.ts`, `src/lib/share.ts`, `components/calculator/ShareActions.tsx`
등)와의 통합.

이 문서는 Edit 권한 없이(코드 미수정) 소스 코드 직독 + `npx vitest`/`npx tsc`/`npm run build`
실행 + `npx tsx`로 순수 함수(`validateHousingSubscriptionScoreInput`,
`calculateHousingSubscriptionScore`, `encodeShareState`/`decodeShareState`)를 독립
스크립트(스크래치패드에만 저장, 소스 미변경)로 직접 호출해 검증한 결과다. 브라우저
자동화 도구(Playwright 등)가 이 환경에 없어 실제 기기·브라우저에서의 시각적 스크린샷
확인은 수행하지 못했다 — 반응형/모바일 항목은 Tailwind 클래스 코드 분석과 컨테이너
폭 계산으로 대체했고, 이 한계를 아래 각 절에 명시한다.

## 기능 테스트

- **계산 전/후 흐름**: 정상 케이스(FORMULA.md 예제 12와 동일한 샘플)로 계산 → 총점 48점,
  항목별 16/20/12점, `homelessStartDate`·경고 카드 없음까지 `ui.test.tsx` 기존 8개 테스트로
  확인됨(재실행 결과 8/8 통과). 입력을 바꾸면 이전 결과가 사라지는지(`update()`가 매번
  `setResult(null)` 호출)도 코드로 확인.
- **초기화**: `handleReset()`이 `emptyForm()`으로 완전히 되돌리고 `result`/`appliedInput`/
  `errors`를 모두 비움 — 기존 테스트로 확인.
- **샘플 값 채우기**: `SAMPLE_FORM`이 FORMULA.md 검증 예제 12(총점 48점)와 정확히 동일 —
  "이 값을 넣으면 이 결과가 나와야 한다"는 DESIGN_SYSTEM.md 권장을 그대로 만족.
- **조건부 필드 노출**: 혼인→혼인신고일, 처분→최근 처분일, 소유중→특례체크,
  미가입→가입일 숨김 4가지 모두 기존 `ui.test.tsx`로 확인, 코드 대조로도 재확인(각 필드가
  `form.isMarried`/`form.housingStatus`/`form.hasSubscriptionAccount` 조건으로만 렌더링).
- **ShareActions(계산 전/후 URL, Base64URL 복원)**: `src/lib/share.ts`의 `buildStateShareUrl`/
  `decodeShareState`를 스크래치패드 스크립트로 직접 호출해 왕복 검증.
  - 계산 전: `url` prop이 `baseUrl`(순수 계산기 URL, 쿼리 없음)로 전달됨(`ui.tsx` 696행).
  - 계산 후: `buildStateShareUrl(baseUrl, { f: form })`으로 인코딩. 샘플 폼을 인코딩→URL
    길이 568자(허용 상한 12,000자 대비 여유 충분)→디코딩→`validateHousingSubscriptionScoreInput`
    재검증 성공→`calculateHousingSubscriptionScore` 재계산 결과 `totalScore=48`로 원본과
    완전히 일치 확인.
  - 손상된 `s` 파라미터(`decodeShareState("!!!not-base64!!!")`), 빈 문자열, 형태가 다른
    JSON(`{ random: 1 }`)을 넣어도 `null` 반환 또는 `validateHousingSubscriptionScoreInput`
    실패로 안전하게 무시됨(예외로 화면이 깨지지 않음) — 확인.
- **`hasQualifyingSpouseInHousehold` 기본값 불일치(발견, 아래 이슈 M-2)**: FORMULA.md
  "입력값" 표는 이 필드의 기본값이 "`isMarried`와 동일"해야 한다고 명시하지만, 실제
  `update("isMarried", true)` 호출 경로 어디에도 `hasQualifyingSpouseInHousehold`를
  함께 `true`로 맞추는 로직이 없다(`ui.tsx` 218~225행 `update()` 범용 setter 확인,
  isMarried 전용 side effect 없음). 재현: 초기 상태(빈 폼)에서 "혼인"만 선택하면
  "배우자 부양가족 인정" 토글은 여전히 "아니요"(`hasQualifyingSpouseInHousehold: false`,
  `emptyForm()` 초기값)로 표시된다 — helpText는 "혼인 상태라면 이 항목은 거의 항상
  '예'"라고 설명하지만 실제 기본 선택 상태는 "아니요"라 설명과 실제 상태가 어긋난다.
  `SAMPLE_FORM`은 두 필드를 처음부터 함께 `true`로 설정해 두었기 때문에 "샘플 값
  채우기"로는 이 문제가 드러나지 않고, 처음부터 손으로 폼을 채우는 실사용자만 겪는다.
  사용자가 이 사실을 못 챙기고 그대로 제출하면 부양가족수가 실제보다 1명 적게
  계산되어 점수가 5점 낮게 나올 수 있다.

## 모바일 테스트 (320 / 375 / 390 / 768 / 1440px)

브라우저 스크린샷 도구가 없어 Tailwind 클래스와 컨테이너 폭을 직접 계산하는 방식으로
대체 확인했다(한계 명시).

- **320~390px(1열 구간, `sm` 640px 미만)**: 항목별 카드 그리드(`grid gap-4 sm:grid-cols-3`,
  724행)는 `sm:` 미만이라 암묵적으로 1열로 쌓인다 — 정상. 2열 토글(혼인 여부/배우자
  인정/통장 보유, `grid max-w-xs grid-cols-2 gap-2`)은 `max-w-xs`(320px)가 상한일 뿐
  실제로는 부모 폭에 맞춰 줄어들므로, 320px 뷰포트(페이지 `px-5`+폼 `p-5` = 좌우 각
  40px 제외 시 컨텐츠 폭 약 240px)에서도 각 버튼 폭 약 116px 확보 — "미혼/혼인",
  "예/아니요", "보유/미보유" 등 짧은 한글 라벨이 잘리지 않는다(계산 근거: 텍스트 폭
  추정). 3열 토글(주택 소유 이력, 411행, `grid gap-2 sm:grid-cols-3`)도 `sm:` 미만이라
  1열로 축소. 날짜 입력은 `w-full`이라 잘리지 않는다.
- **768px(`md`, `sm` 이상)**: 항목별 카드 그리드가 `sm:grid-cols-3`라 이 폭에서 이미
  3열로 전환된다(아래 "반응형" 절 참고 — 문서 패턴과 다름). 컨테이너 폭 계산(페이지
  `px-8`×2=64px 제외 시 704px, 카드 갭 2×16px=32px 제외 시 카드당 약 224px, 카드 내부
  `p-5` 40px 제외 시 컨텐츠 약 184px)으로는 "무주택기간"/"부양가족수"/"청약통장
  가입기간" 제목과 점수, "상한 도달" 배지가 한 줄에 다 안 들어갈 수 있으나(배지가
  `shrink-0`이라 제목이 대신 줄바꿈), 버튼·숫자가 페이지 밖으로 잘리는(가로 스크롤
  발생) 상황은 계산상 발견되지 않았다 — 한글 텍스트는 글자 단위로 줄바꿈되어 폭
  초과분은 세로로 흡수된다.
- **1440px**: `max-w-6xl`(72rem=1152px)로 상한이 걸려 있어 큰 화면에서도 좌우 여백만
  늘어나고 레이아웃이 과도하게 늘어지지 않는다.
- **`w-[...]`/고정 픽셀 폭/`overflow-x`류 위험 클래스**: 이 계산기 파일 전체를
  grep했으나 하나도 없음 — 가로 스크롤을 유발할 고정폭 요소가 코드 레벨에서 발견되지
  않았다.
- **실기기/실브라우저 스크린샷 미실시(한계)**: 위 결론은 코드/치수 계산에 근거한
  것으로, 폰트 실제 렌더링 폭·서브픽셀 반올림까지 반영한 것은 아니다. 정식 배포 전
  실제 브라우저 DevTools 반응형 모드로 5개 폭을 육안 확인할 것을 권고한다.

## 브라우저 테스트

실제 다중 브라우저(Chromium/Firefox/Safari) 구동 도구가 없어 코드 레벨의 브라우저
호환성 위험 요소만 점검했다.

- 사용 API: `navigator.clipboard.writeText`(기능 미지원 시 `document.execCommand("copy")`
  폴백 이미 구현, `ShareActions.tsx`), `navigator.share`(기능 탐지 후 조건부 노출),
  `Intl.DateTimeFormat`(Asia/Seoul 고정), `<input type="date">`(모든 브라우저 표준 지원,
  `min`/`max` 지정으로 DESIGN_SYSTEM.md가 지적한 "Chromium 연도 서브필드 무한 입력" 이슈
  회피 확인) — 전부 이미 이 저장소의 다른 published 계산기(severance-pay 등)가 사용 중인
  패턴 재사용, 새로운 최신 CSS 기능(`oklch`, `color-mix`, `@supports`, `backdrop-filter`
  등)은 `globals.css`에도 이 계산기 코드에도 없음(grep 결과 없음) — 구형 브라우저
  호환성 위험을 새로 추가하지 않았다.
- **실제 다중 브라우저 구동 미실시(한계)**: 이 환경에 Playwright 등 자동화 도구가 없어
  Chromium/Firefox/Safari 실제 렌더링 차이(특히 `<input type="date">` 네이티브 UI, 라디오
  포커스 스타일)는 육안 확인하지 못했다. 배포 전 최소 Chrome·Firefox·Safari(또는 iOS
  Safari) 최신 버전에서 폼 제출·공유·다크모드 전환을 1회씩 수동 확인할 것을 권고한다.

## 입력 검증

`validateHousingSubscriptionScoreInput`을 스크래치패드 스크립트로 직접 호출해 아래
케이스를 확인했다(전부 기대대로 동작).

- **빈 입력**: 전 필드 빈 값 → `baseDate`/`birthDate`/`housingStatus`/
  `qualifyingAscendantCount`/`qualifyingDescendantCount`/`subscriptionAccountOpenDate`
  6개 필드 오류 동시 발생, 계산은 실행되지 않음.
- **음수**: `qualifyingAscendantCount="-1"` → "0 이상의 정수로 입력해 주세요" 오류.
  단, 실제 UI 입력창(`onChange`가 `e.target.value.replace(/[^0-9]/g, "")`로 즉시
  정제)에서는 "-" 기호 자체가 타이핑 즉시 제거되어(`"-1"` → `"1"`) 음수를 아예 입력할
  수 없다 — 검증 로직과 UI 정제 로직이 이중으로 음수를 차단.
- **0**: `qualifyingAscendantCount="0"`(기본값) → 정상 통과. `dependentCount=0`일 때
  `dependentScore=5`(0점 아님)도 `logic.ts` 직접 호출로 재확인(Golden Test와 별개로
  QA가 독립 재확인).
- **매우 큰 값**: `qualifyingAscendantCount="999999999999"` → 정수 파싱은 되지만
  `MAX_ASCENDANT_COUNT(4)` 초과로 오류. UI 입력창에 초대형 문자열을 붙여넣어도
  숫자만 남을 뿐 길이 제한이 없어 그대로 검증 단계로 넘어가지만, 상한 검사가 이를
  안전하게 차단함(오버플로/NaN으로 인한 예외 없음).
- **소수**: `qualifyingDescendantCount="1.5"` → "0 이상의 정수로" 오류. 단, 실제 UI
  입력창에서 "1.5"를 타이핑하면 `.`이 정제 정규식에 걸러져 조용히 "15"로 합쳐진다(아래
  이슈 L-3, 사용자에게 아무 안내 없이 값이 왜곡된 뒤에야 "상한 초과" 오류로 간접
  드러남).
- **잘못된 문자**:
  - 숫자 필드: `"abc"`, `"1e5"`(→ 정제 후 `"15"`), 공백만(`"   "` → 미입력 오류) 전부
    적절히 처리(오류 표시 또는 UI 정제).
  - 날짜 필드: `"abcd-ef-gh"`(형식 오류), `"1990-02-30"`(존재하지 않는 날짜 —
    `isValidIsoDate`의 왕복 비교로 정확히 걸러짐), `"199001-01-01"`(자릿수 초과 —
    정규식 `^\d{4}-\d{2}-\d{2}$`가 거부) 모두 "올바른 OOO을 입력해 주세요" 오류로 처리.
- **미래 날짜**: `birthDate`를 미래로 설정 → "생년월일은 기준일보다 늦을 수 없습니다"
  오류(연쇄적으로 `subscriptionAccountOpenDate`도 `birthDate`보다 이전이라는 오류가
  함께 뜨는 것도 확인 — 여러 필드 오류 동시 표시가 정상 동작임을 확인). `baseDate`를
  오늘+5년 초과로 설정 → "오늘로부터 5년 이내로" 오류.
- **날짜 순서 오류**: 혼인신고일이 생년월일보다 이름, 최근 처분일이 기준일보다
  미래, 청약통장 가입일이 생년월일보다 이전/기준일보다 미래 — 6가지 조합 전부
  `validation.test.ts` 기존 테스트 + QA 재실행으로 확인.
- **부양가족 수 상한 초과**: 직계존속 5명(상한 4명 초과) → 오류, 직계비속 11명(상한
  10명 초과) → 오류. 반면 "6명 이상은 정상 동작"(직계존속4+직계비속10=14명, 배우자
  포함 15명)은 검증을 통과하고 `logic.ts`가 35점으로 캡하는 것도 재확인(FORMULA.md
  의도대로 입력 상한과 점수 상한이 다른 값으로 설계된 것을 확인 — 버그 아님).
- **필수값 누락(조건부)**: 혼인인데 혼인신고일 누락, 처분인데 최근 처분일 누락,
  통장보유인데 가입일 누락 3가지 전부 오류 발생 확인.

## Copy / Reset

- **Reset(초기화)**: `handleReset()` 확인 — 폼을 `emptyForm()`(오늘 날짜만 남기고 전부
  빈 값)으로, `errors`/`result`/`appliedInput`을 전부 초기 상태로 되돌림. 기존
  `ui.test.tsx` "초기화" 테스트로 확인(생년월일 값이 빈 문자열로 돌아오고 핵심 결과
  카드가 사라짐).
- **Copy(링크 복사)**: 계산기 자체 구현이 아니라 공용 `ShareActions`의 "링크 복사"
  버튼(`copyText()` — `navigator.clipboard.writeText` 우선, 미지원 시
  `document.execCommand("copy")` 폴백)을 그대로 재사용한다. 이 계산기 통합에서 확인한
  것: `url` prop이 계산 전에는 `baseUrl`(쿼리 없는 계산기 URL), 계산 후에는
  `buildStateShareUrl(baseUrl, { f: form })`(Base64URL 상태 포함 결과 URL)로 정확히
  전환됨(위 "기능 테스트" ShareActions 절 참고). 공용 컴포넌트 자체의 복사 성공/실패
  피드백(`"링크를 복사했습니다."` 등)은 `ShareActions.test.tsx`가 별도로 이미 검증하고
  있어 이 계산기에서 재검증하지 않았다(중복 방지).

## Console Error

- **`npm run build`(next build, Turbopack)**: 성공, 컴파일·TypeScript·정적 페이지 생성
  전부 오류 없음(`draft` 상태라 sitemap/정적 프리렌더 목록에는 없지만
  `calculator-components.ts` 매핑으로 URL 직접 접근 시 렌더링되는 기존 unemployment-benefit
  draft 선례와 동일하게 동작 확인).
- **개발 서버 구동 확인**: 이미 실행 중이던 `next dev`(포트 3000)에
  `/calculators/housing-subscription-score`를 curl로 요청 → HTTP 200, 응답 HTML 안에
  실제 런타임 에러(React 에러 바운더리에 `error` 값이 채워지는 경우)가 아니라
  Next.js 프레임워크의 정적 에러 바운더리 보일러플레이트(`"error":"$undefined"`)만
  확인 — 실제 에러 없음.
- **SSR 직접 렌더링(초기 상태)**: `react-dom/server`의 `renderToStaticMarkup`으로 이
  컴포넌트를 스크래치패드 스크립트에서 직접 렌더링하며 `console.error`/`console.warn`을
  가로채 카운트 — 초기(미계산) 상태에서 0건.
- **계산 후 상태(경고 카드·정책 특례 3종·breakdown 포함) 렌더링**: SSR로는 폼 제출
  이벤트를 재현할 수 없어, 기존 `ui.test.tsx`(정상 계산·현재 소유 중 경고·통장 미가입
  경고·정책 특례 3종 노출까지 포함하는 8개 시나리오)를 `--reporter=verbose`로 재실행해
  터미널에 어떤 `console.error`/`console.warn`도 출력되지 않음을 확인(React가 key
  누락·controlled/uncontrolled 전환·act() 경고 등을 감지하면 이 리포터에 그대로 노출된다
  — 아무 것도 안 뜬 것으로 이상 없음을 확인).
- 결론: Console Error 0건.

## Accessibility

- **label 연결**: 모든 텍스트/날짜/숫자 입력에 `htmlFor`/`id` 쌍 존재(`useId()` 기반
  고유 접두사) — 확인. 라디오형 토글(혼인 여부 등)은 `<label>`이 `<input>`을 감싸는
  암묵적 연결 방식이라 별도 `htmlFor` 없이도 유효.
- **aria-live**: 결과 영역 전체가 `aria-live="polite"`(701행)로 감싸여 있어 계산 결과
  갱신이 스크린리더에 안내됨 — 확인.
- **role="alert"**: 모든 필드별 오류 메시지(`<p role="alert">`)가 존재 — 확인. 다만
  아래 이슈(M-3)에서 지적하듯 `aria-describedby`가 오류 문단의 `id`를 가리키지 않아
  "역할 부여"는 됐지만 "입력 요소와의 명시적 연결"은 이 계산기 안에서 이뤄지지 않았다.
- **FaqAccordion aria-expanded**: 공용 컴포넌트(`FaqAccordion.tsx`) 코드 확인 —
  버튼에 `aria-expanded`/`aria-controls`, 패널에 `role="region"`+`aria-labelledby"`,
  펼침 상태를 아이콘 회전(`aria-hidden` 처리된 시각 전용 요소)과 `aria-expanded` 양쪽으로
  전달 — DESIGN_SYSTEM.md 요구사항 그대로 구현되어 있음(계산기별 커스터마이징 없이
  공용 컴포넌트를 그대로 사용해 이 계산기 고유 문제 없음).
- **키보드 포커스(이슈 발견, M-1)**: 혼인 여부/주택 소유 이력/배우자 부양가족 인정/
  청약통장 보유 여부 4개 토글 그룹이 전부 "시각적 라벨(`<label>`)이 감싼
  `sr-only` `<input type="radio">`" 패턴을 쓰는데, 이 4곳 어디에도
  `focus-within:ring` 계열 클래스가 없다(코드 확인: 348~370행, 411~433행, 504~531행,
  605~628행 전부 `focus-within` 없음). `globals.css`의 전역 `:focus-visible { outline:
  2px solid var(--primary) }`는 실제로 포커스를 받는 `sr-only` `<input>`(1×1px로
  clip된 요소) 자체에 적용되므로, 키보드로 Tab 이동 시 시각적으로 어떤 옵션이
  포커스됐는지 사실상 보이지 않는다. 이 저장소 안에 이미 올바른 해법이 존재한다
  (`business-days/ui.tsx` "focus-within:ring-2 focus-within:ring-primary",
  `military-discharge-date/ui.tsx` "focus-within:ring-2 focus-within:ring-primary
  focus-within:ring-offset-2", `parental-leave-benefit/ui.tsx`도 동일 패턴) — 이
  계산기만 4곳 전부 그 클래스가 누락되어 있다. 단, `bmi-calculator`(published)의 성별
  토글도 동일하게 `focus-within`이 없어 이 저장소 전체에서 100% 일관되게 지켜지는
  규칙은 아니라는 점도 함께 기록한다(참고용 — 이 계산기의 결함을 상쇄하지는 않음).
- **오류 메시지의 `aria-describedby` 연결(이슈 발견, M-3)**: DESIGN_SYSTEM.md
  "접근성" 절은 "오류는 `role=\"alert\"` + `aria-describedby`로 입력과 연결"을
  명시하고, 이 저장소의 `severance-pay/ui.tsx`(436~440행)는 실제로
  `aria-describedby={[message ? errorId : null, field.helpText ? helpId : null]
  .filter(Boolean).join(" ")}`처럼 오류 id와 도움말 id를 동적으로 합쳐 연결한다.
  `housing-subscription-score/ui.tsx`는 8개 오류 발생 가능 필드(`baseDate`,
  `birthDate`, `marriageDate`, `mostRecentDisposalDate`, `qualifyingAscendantCount`,
  `qualifyingDescendantCount`, `subscriptionAccountOpenDate`, 그리고 `housingStatus`
  fieldset) 전부에서 `aria-describedby`가 helpText id만 가리키거나(예:
  `${formId}-baseDate-help`) 아예 없고, 오류 문단 자체에 `id`도 부여되지 않는다. 즉
  최초 제출 시 여러 오류가 동시에 나타나는 순간에는 `role="alert"`(assertive live
  region)가 전부 즉시 안내하지만, 사용자가 이후 Tab으로 특정 오류 필드에 재진입할
  때는 스크린리더가 그 필드의 구체적 오류 사유를 다시 안내받지 못한다(라벨/도움말만
  들림). severance-pay가 이미 세운 해법을 그대로 적용하면 해결 가능.
- **명도 대비**: 새 색상 토큰을 임의로 추가하지 않고 기존 시맨틱 토큰(`text-muted`,
  `text-danger`, `bg-warning-surface`/`border-warning-border`)과, 이미 여러
  published 계산기가 공통으로 쓰는 `text-zinc-700 dark:text-zinc-300`(경고/설명 표면
  위 본문 텍스트) 관행을 그대로 재사용 — 이 계산기만의 새로운 대비 위험은 없음.

## 반응형

- **입력 폼의 토글 그리드**: 2열(`grid max-w-xs grid-cols-2 gap-2`, 혼인 여부/배우자
  인정/통장 보유)과 3열(`grid gap-2 sm:grid-cols-3`, 주택 소유 이력)은 모바일에서
  전부 `sm:` 미만 구간에 맞춰 축소되어 문제 없음.
- **결과 항목별 카드 그리드(이슈 발견, L-1)**: `docs/DESIGN_SYSTEM.md` "모바일" 절이
  명시한 카드 그리드 공통 패턴은 `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`이다.
  이 계산기의 항목별 카드 3개 그리드(724행)는 `grid gap-4 sm:grid-cols-3`를 써서
  `md`(768px)에서 2열을 거치지 않고 `sm`(640px)부터 곧바로 3열로 전환된다 — 문서
  패턴과 다르다. 실제 카드가 잘리거나 겹치는 것은 위 "모바일 테스트" 절의 치수
  계산상 발견되지 않았으나(가로 스크롤 발생 안 함), 768px에서 문서가 의도한 "중간
  폭에서는 2열" 단계 없이 곧바로 3열이 되어 각 카드 여백이 문서 패턴 대비 더
  좁아진다. 이 계산기 이전에는 3개짜리 카드 그리드 선례가 없어(기존 계산기들은
  전부 2열 `dl` 그리드) Builder가 새로 정한 값으로 보인다.
- **적용된 입력값 `dl`(790행)**: `grid-cols-1 gap-2 sm:grid-cols-2`로 문서 패턴과
  유사(다만 `md:`가 아니라 `sm:`) — 이 부분은 기존 `severance-pay`/
  `weekly-holiday-allowance`의 `sm:grid-cols-2` 관행과 일치해 새로운 편차가 아니다.
  카드 그리드(3열)에서만 편차가 발견됨.
- **가로 스크롤**: 고정 픽셀 폭(`w-[...]`)이나 `overflow-x` 관련 클래스가 이 계산기
  파일에 전혀 없음(grep 확인) — 320~1440px 전 구간에서 가로 스크롤을 유발할 코드
  레벨 요인 없음.

## 회귀 테스트 (기존 계산기, CLAUDE.md/EVALUATION.md "회귀 방지")

이번 작업이 `src/lib/date-calc.ts`에 새 함수(`calendarFullYearsBetweenUtc`/
`calendarFullMonthsBetweenUtc`)를 추가했으므로, 이를 공유하는 계산기들과 별도 날짜
유틸을 쓰는 age-calculator를 포함해 재확인했다.

```
npx vitest run src/calculators/severance-pay src/calculators/unemployment-benefit \
  src/calculators/age-calculator src/lib/date-calc.test.ts --no-file-parallelism
→ Test Files 10 passed (10) / Tests 137 passed (137)

npx vitest run --no-file-parallelism (전체 스위트)
→ Test Files 47 passed (47) / Tests 466 passed (466)

npx tsc --noEmit
→ 오류 0

npm run build (next build, Turbopack)
→ 성공, TypeScript 통과, 정적 페이지 생성 정상
```

severance-pay·unemployment-benefit의 `logic.test.ts`(평균임금 산정기간 등
`calendarMonthsBeforeUtc` 공유)와 age-calculator의 자체 날짜 유틸(`date-utils.ts`,
윤년 clamp 방식이 이번에 추가된 함수와 별개로 독립 구현됨) 전부 회귀 없이 통과했다.

## 발견된 이슈 (등급별)

| 등급 | 이슈 | 근거/위치 | 비고 |
|---|---|---|---|
| Critical | 없음 | — | — |
| High | 없음 | — | — |
| **Medium (M-1)** | 혼인 여부/주택 소유 이력/배우자 부양가족 인정/청약통장 보유 여부 4개 토글 그룹의 `sr-only` 라디오에 키보드 포커스 시각적 표시가 없다(`focus-within:ring` 누락) | `ui.tsx` 348~370행, 411~433행, 504~531행, 605~628행. 대조: `business-days`/`military-discharge-date`/`parental-leave-benefit`은 동일 패턴에 `focus-within:ring-2 focus-within:ring-primary` 적용 | `bmi-calculator`(published)도 동일 결함이 있어 이 저장소 전체가 100% 일관되진 않음(참고, 면책 아님) |
| **Medium (M-2)** | `hasQualifyingSpouseInHousehold` 기본값이 FORMULA.md "입력값" 표(`isMarried`와 동일해야 함) 요구와 다르게, `isMarried`를 `true`로 바꿔도 자동으로 `true`가 되지 않고 "아니요"로 남는다 | `ui.tsx` 218~225행(`update()`), 87~102행(`emptyForm()`) — isMarried 전용 동기화 로직 없음. helpText(533~539행)는 "거의 항상 예"라고 안내하지만 실제 기본 선택 상태와 모순 | `SAMPLE_FORM`은 두 값을 함께 true로 둬서 샘플 흐름에서는 드러나지 않음. 실사용자가 손으로 입력할 때만 재현 |
| **Medium (M-3)** | 오류 메시지(`role="alert"`)가 해당 입력의 `aria-describedby`로 연결되지 않는다(오류 문단에 `id` 자체가 없음) | `ui.tsx`의 8개 오류 필드 전체(`baseDate`/`birthDate`/`marriageDate`/`mostRecentDisposalDate`/`qualifyingAscendantCount`/`qualifyingDescendantCount`/`subscriptionAccountOpenDate`/`housingStatus`) | `severance-pay/ui.tsx` 436~440행이 이미 올바른 해법(오류 id+도움말 id를 join)을 구현해 둠 — 그대로 적용 가능 |
| Low (L-1) | 결과 항목별 카드 3개 그리드가 `docs/DESIGN_SYSTEM.md`의 문서화된 `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` 패턴이 아니라 `sm:grid-cols-3`를 써서 768px에서 곧바로 3열로 전환된다 | `ui.tsx` 724행 | 실제 가로 스크롤/잘림은 치수 계산상 발견 안 됨(코드 리뷰 한계 있음, 위 "모바일 테스트" 참고) |
| Low (L-2) | `content.ts`에 정의된 FAQ 5개가 화면(FaqAccordion)에는 표시되지만, SEO용 `FAQPage` JSON-LD(`app/calculators/[slug]/page.tsx`의 `faqItemsBySlug` 맵)에는 등록되어 있지 않다 | `app/calculators/[slug]/page.tsx` 31~40행에 `housing-subscription-score` 키 없음 | SPEC.md Should Have 항목(구조화 데이터)이고 현재 `status: draft`라 sitemap에도 없어 즉시 영향은 적음 |
| Low (L-3) | 직계존속/직계비속 수 입력창에서 소수점(`.`)을 타이핑하면 정제 정규식(`replace(/[^0-9]/g, "")`)이 `.`만 지우고 앞뒤 숫자를 그대로 이어 붙여 사용자 모르게 값이 바뀐다(예: "1.5" 입력 → 실제 값 "15") | `ui.tsx` 553~555행, 580~582행 | 이후 상한 초과 오류로 간접적으로 드러나지만, "왜 15가 됐는지"에 대한 안내는 없음 |

## 판정

**PASS**

- Critical: 0, High: 0 — `docs/EVALUATION.md` PASS 기준("Critical 0, High 0")을 충족한다.
- Medium 3건(M-1 키보드 포커스 표시 누락, M-2 배우자 부양가족 기본값 불일치, M-3 오류
  `aria-describedby` 미연결)과 Low 3건(L-1 카드 그리드 브레이크포인트 문서 패턴 편차,
  L-2 FAQPage JSON-LD 미등록, L-3 소수점 입력 무음 정제)을 발견했으나, 계산 결과 자체를
  틀리게 만드는 이슈는 아니다(M-2도 "제출된 데이터에 대한 계산"은 항상 정확하고,
  기본값 상태가 사용자 의도와 다를 수 있다는 UX/스펙 준수 문제다).
- Console Error 0건, TypeScript Error 0건, 전체 Vitest 스위트(47개 파일 466개 테스트) 및
  기존 계산기 회귀 테스트(137개) 전부 통과, `npm run build` 성공 — Golden Test 100% PASS
  포함 확인.
- Mobile Critical Issue 0건(코드/치수 계산 기준, 실기기 스크린샷 확인은 하지 못한 한계
  있음 — 배포 전 수동 확인 권고).
- 다음 Optimizer 라운드에서 M-1·M-2·M-3 세 건의 해결을 권고한다(전부 저비용 수정 —
  `focus-within:ring` 클래스 추가, `isMarried` 토글 시 `hasQualifyingSpouseInHousehold`
  동기화 한 줄 추가, `aria-describedby`에 오류 id 포함). L-1·L-2·L-3은 우선순위가 낮아
  다음 정기 정비 라운드로 미뤄도 무방하다.

## QA 재검증 (라운드 1)

2026-09-06. Optimizer가 `tasks/housing-subscription-score/EVALUATION.md` "## Optimizer
수정 (라운드 3, QA 대응)"에서 위 Medium 3건(M-1/M-2/M-3)·Low 3건(L-1/L-2/L-3) 전부를
반영했다고 보고했다. 이번 재검증은 각 수정의 실제 코드 반영 여부, 이전에 지적한 문제가
실제로 해소됐는지, 그리고 이번 수정이 새로운 문제를 만들지 않았는지를 직접 확인한다.
Edit 권한 없이(코드 미수정) `ui.tsx`/`content.ts`/`app/calculators/[slug]/page.tsx`
전체 재독 + 스크래치패드 독립 스크립트(React+jsdom, 소스 미변경, 세션 종료 시 폐기)로
런타임 동작을 직접 재현 + `npx vitest run --no-file-parallelism`/`npx tsc --noEmit`/
`npm run build` 재실행으로 확인했다.

### 6가지 수정 반영 여부 확인

전부 실제 코드에 반영되어 있음을 `ui.tsx`/`content.ts`/`page.tsx` 직접 읽기로 확인했다.

1. **`isMarried` ↔ `hasQualifyingSpouseInHousehold` 동기화**: `ui.tsx` 218~235행
   `update()` 안에 `if (key === "isMarried") { next.hasQualifyingSpouseInHousehold =
   value as unknown as boolean; }` 분기가 추가되어 있다. 주석(224~227행)도 "isMarried가
   바뀌는 전환 시점에만 함께 맞추고, 그 사이 사용자가 수동으로 바꾼 값은 건드리지
   않는다"는 의도를 정확히 설명한다.
2. **8개 오류 필드 `aria-describedby` 연결**: `combineDescribedBy(...ids)` 헬퍼(238~242행,
   `severance-pay/ui.tsx` 436~440행과 동일한 "오류 id + 도움말 id join" 방식)가 추가되어
   있고, `baseDate`(315~318행)/`birthDate`(352~355행)/`marriageDate`(416~418행)/
   `housingStatus`(라디오 3개 각각, 454~457행)/`mostRecentDisposalDate`(492~495행)/
   `qualifyingAscendantCount`(590~594행)/`qualifyingDescendantCount`(629~633행)/
   `subscriptionAccountOpenDate`(709~713행) 8곳 전부에 오류 발생 시 오류 `<p>`의 `id`를
   포함하도록 연결되어 있고, 각 오류 `<p role="alert">`에도 대응하는 `id`가 새로
   부여되어 있다(`${formId}-baseDate-error` 등, 이전엔 `id` 자체가 없었음).
3. **4개 토글 그룹 `focus-within:ring`**: 혼인 여부(378행)/주택 소유 이력(442행)/
   배우자 부양가족 인정(551행)/청약통장 보유 여부(674행) 4곳 `<label>` className에
   전부 `focus-within:ring-2 focus-within:ring-primary`가 추가되어 있다(grep으로 4곳
   모두 확인, 빠진 곳 없음).
4. **결과 카드 그리드 브레이크포인트**: 794행이 `grid grid-cols-1 gap-4
   md:grid-cols-2 lg:grid-cols-3`로 바뀌어 `docs/DESIGN_SYSTEM.md` 표준 패턴과
   정확히 일치한다(`sm:grid-cols-3` 잔존 없음, grep으로 확인).
5. **직계존속/직계비속 입력 정제**: 595~601행/634~640행이 `e.target.value.replace(...)`
   방식에서 `if (/^[0-9]*$/.test(e.target.value)) { update(...); }` 방식으로 바뀌어
   있다(주석에 "QA L-3" 명시). 두 필드 모두 동일하게 적용됨을 확인.
6. **FAQPage JSON-LD 등록**: `content.ts` 126~136행에 `housingSubscriptionScoreFaqSeoItems`
   (원본 `housingSubscriptionScoreFaqItems`의 `answer` 배열을 공백 join한 평탄화 버전)가
   새로 export되어 있고, `app/calculators/[slug]/page.tsx` 17행에 이를 import, 32~43행
   `faqItemsBySlug` 맵의 마지막 항목(42행)으로 `"housing-subscription-score":
   housingSubscriptionScoreFaqSeoItems`가 추가되어 있다.

### 1. `isMarried`/`hasQualifyingSpouseInHousehold` 동기화 — 실제 동작 추적

`update()` 전체를 다시 옮기면:

```ts
function update<K extends keyof RawHousingSubscriptionScoreFormInput>(
  key: K,
  value: RawHousingSubscriptionScoreFormInput[K],
) {
  setForm((prev) => {
    const next = { ...prev, [key]: value };
    if (key === "isMarried") {
      next.hasQualifyingSpouseInHousehold = value as unknown as boolean;
    }
    return next;
  });
  setResult(null);
  setAppliedInput(null);
}
```

분기 조건이 `key === "isMarried"` 하나뿐이므로, 이 함수가 호출되는 모든 경로를 실제로
나열해 추적했다(`ui.tsx` 전체에서 `update(`을 grep):

- 혼인 여부 라디오(389행): `update("isMarried", value)` → 분기를 탄다.
- 배우자 부양가족 인정 라디오(565행): `update("hasQualifyingSpouseInHousehold", value)`
  → `key !== "isMarried"`이므로 분기를 타지 않고, 그 값 하나만 반영된다.
- 그 외 모든 필드(생년월일·주택 소유 이력·혼인신고일·직계존속/직계비속 수·통장 보유
  여부·가입일 등) → 각각 자기 자신의 `key`로만 `update` 호출, `hasQualifyingSpouseInHousehold`
  를 건드리는 코드 경로가 전혀 없다.

**요청받은 두 시나리오를 직접 추적한 결과**:

- **false→true→false 왕복**: 초기 `isMarried=false, spouse=false`(`emptyForm()`) →
  "혼인" 클릭(`update("isMarried", true)`) → 분기 발동, `spouse=true`로 동기화 →
  "미혼" 클릭(`update("isMarried", false)`) → 분기 재발동, `spouse=false`로 동기화.
  왕복 양방향 모두 요구된 대로 자동 동기화되며, 이 정확한 시퀀스가
  `ui.test.tsx`(109~122행) "혼인 여부를 '혼인'으로 바꾸면 배우자 부양가족 인정이
  자동으로 '예'가 된다(QA M-2 회귀)" 테스트로 이미 자동화되어 있고, 재실행 결과도
  통과했다(아래 "테스트 실행 결과" 참고).
- **수동으로 "아니요"로 바꾼 뒤 다른 필드를 건드리는 경우**: `hasQualifyingSpouseInHousehold`
  라디오는 `disabled={!form.isMarried}`(563행)라 `isMarried=true`일 때만 조작 가능하다.
  즉 "혼인" 선택(자동 `spouse=true`) → 배우자 인정 라디오를 수동으로 "아니요" 클릭
  (`update("hasQualifyingSpouseInHousehold", false)`, `spouse=false`) → 이후 생년월일·
  주택 소유 이력 등 **다른 필드**를 아무리 바꿔도 그 `update` 호출들은 전부
  `key !== "isMarried"`이므로 `spouse` 필드를 재대입하는 코드 경로 자체가 없다 —
  `{ ...prev, [key]: value }`의 spread가 `prev.hasQualifyingSpouseInHousehold`를
  그대로 보존한다. 이 부분은 이 저장소에 자동 회귀 테스트가 없어 QA가 React+jsdom
  독립 재현 스크립트로 직접 실행해 확인했다(아래 "런타임 재현" 참고) — 실제로 유지됨을
  확인했다.
- **참고(설계 경계, 문제 아님)**: 수동으로 "아니요"로 바꾼 뒤 `isMarried` 자체를 다시
  false→true로 왕복시키면(즉 "다른 필드"가 아니라 `isMarried` 자체를 다시 건드리면)
  `spouse`는 새로 `true`로 재동기화되어 수동 선택이 사라진다. 이는 Optimizer의 설계
  의도("isMarried가 그대로인 한 보존")와 정확히 일치하는 동작이며, `hasQualifyingSpouseInHousehold`가
  `!isMarried`일 때는 어차피 `disabled`로 조작 불가능하고 `validation.ts`
  260~262행(`hasQualifyingSpouseInHousehold: raw.isMarried ?
  raw.hasQualifyingSpouseInHousehold : false`)이 제출 시점에 항상 `isMarried`
  기준으로 다시 정규화하므로, 계산 결과에는 어떤 경우에도 영향이 없다 — 문제로
  보지 않는다.

**런타임 재현(React+jsdom, 스크래치패드, 소스 미변경)**: `ui.tsx`의 정확한 패턴(같은
`update` 시그니처와 동일 분기 로직)을 별도 최소 컴포넌트로 재현해 `@testing-library`
없이 순수 `react-dom/client`+`act()`+jsdom으로 다음 시퀀스를 실행했다 — "혼인" 클릭 →
배우자 인정 수동 "아니요" 클릭 → 무관한 다른 필드(생년월일) 변경 → 또 다른 무관한
필드(주택 소유 이력) 변경. 매 단계에서 `hasQualifyingSpouseInHousehold` 상태를 콘솔로
직접 출력해 추적한 결과, "아니요"로 바꾼 이후에는 무관한 필드를 몇 번을 바꿔도 계속
`false`로 유지됨을 확인했다(강제 리셋 없음). 이어서 `isMarried`를 다시 false→true로
왕복하면 그 즉시 `true`로 재동기화되는 것도 함께 확인해, 위 코드 분석과 정확히
일치함을 실증했다.

**결론**: M-2 수정은 요청받은 두 시나리오 모두 코드/런타임 양쪽에서 의도대로 동작한다.
`validation.ts`의 기존 정규화 로직(조건 미해당 시 항상 `false`로 강제)이 이중 안전망
역할을 하므로, 설령 UI 동기화 로직에 틈이 있었더라도 실제 계산 결과가 왜곡될 위험은
원래 없었다 — 이번 수정은 "표시값과 helpText 설명의 불일치"라는 UX 문제를 해소한
것이며, 계산 정확성 자체에는 영향이 없었다는 점을 재확인한다.

### 2. 직계존속/직계비속 입력 정제 — 백스페이스/붙여넣기 재검증

`onChange`가 `if (/^[0-9]*$/.test(e.target.value)) { update(...); }`로 바뀌면서,
정규식이 실패하면 `update()` 자체가 호출되지 않는다(이전 방식은 항상 `update()`를
호출해 정제된 문자열을 대입했음). 이 변경이 "실패 시 아무 것도 하지 않는다"는 방식이라,
**React가 실제로 DOM의 표시값을 상태값으로 되돌리는지**(그렇지 않으면 화면에는 잘못된
문자가 남아있는데 내부 상태는 예전 값에 머무는 "표시 불일치" 버그가 될 수 있다)를
가장 중요하게 검증해야 한다고 판단해, 이 부분만 별도로 React+jsdom 런타임 재현
스크립트(스크래치패드 전용, `ui.tsx`와 동일한 정규식·분기 패턴을 최소 컴포넌트로 복제,
소스 미변경)를 작성해 다음 시퀀스를 실제로 실행했다(`Object.getOwnPropertyDescriptor`로
얻은 네이티브 `value` setter로 값을 직접 대입한 뒤 `input` 이벤트를 디스패치하는,
React 공식 테스트 도구·React Testing Library가 쓰는 것과 동일한 실제 타이핑 재현 기법 사용):

| 단계 | 입력(네이티브 DOM에 대입) | 결과 DOM `value` | 결과 React 상태 |
|---|---|---|---|
| 초기값 | `"5"` | `"5"` | `"5"` |
| 숫자만 입력 | `"56"` | `"56"` | `"56"` |
| 소수점 삽입 | `"56."` | `"56"` | `"56"` |
| 소수점 뒤 추가 타이핑 | `"56.7"` | `"56"` | `"56"` |
| 백스페이스로 전체 삭제 | `""` | `""` | `""` |
| 대량 숫자 붙여넣기 | `"999999999999"` | `"999999999999"` | `"999999999999"` |
| 숫자+문자 혼합 붙여넣기 | `"1,234"` | `"999999999999"`(변화 없음) | `"999999999999"`(변화 없음) |

**핵심 확인 사항**: 소수점이나 쉼표가 섞인 입력을 시도하면 React 상태뿐 아니라 **DOM에
실제로 표시되는 값도** 직전의 유효한 값으로 즉시 되돌아간다(React DOM이 controlled
input의 값 추적 메커니즘을 통해, 앱이 `setState`를 호출하지 않아도 이벤트 처리
과정에서 동기적으로 DOM의 `value`를 되돌리기 때문 — 이는 "잘못된 입력을 조용히
버리는" 방식의 React controlled input 패턴에서 널리 쓰이는 정상 동작이며, 이번
재현에서 화면과 상태가 어긋나는 "표시 불일치"는 전혀 관찰되지 않았다). 즉:

- **백스페이스**: 정상 동작. 빈 문자열(`""`)은 정규식 `/^[0-9]*$/`가 0회 반복도
  허용하므로 통과해 `update("")`가 호출되고, 필드를 완전히 비울 수 있다(이후 제출 시
  "값을 입력해 주세요" 오류로 이어짐 — 기존 "빈 입력" 검증 케이스와 동일).
- **붙여넣기(순수 숫자)**: 정상 동작. 길이 제한 없이 그대로 반영되고, 이후
  `validateHousingSubscriptionScoreInput`의 `MAX_ASCENDANT_COUNT`/`MAX_DESCENDANT_COUNT`
  상한 검사가 안전하게 차단한다(위 "입력 검증" 절의 기존 "매우 큰 값" 시나리오와 동일한
  안전망, 이번 변경으로 달라지지 않음).
- **붙여넣기(숫자+문자 혼합, 예: "1,234")**: 전체가 그대로 무시되고 DOM/상태 모두 직전
  값에 머문다 — L-3가 원래 의도한 "그 입력 전체를 무시한다"는 동작이 화면에서도
  정확히 실현된다(이전 QA가 지적했던 "1.5 → 15로 조용히 이어붙는" 문제가 재발하지
  않을 뿐 아니라, 새로운 "화면과 상태 불일치" 버그도 만들지 않았다는 것까지 확인).

### 3. FAQPage JSON-LD 등록 — 다른 계산기 영향 여부

`app/calculators/[slug]/page.tsx` 전체를 다시 읽어 확인했다. 기존 9개 항목
(`severance-pay`/`weekly-holiday-allowance`/`four-major-insurance`/
`military-discharge-date`/`business-days`/`parental-leave-benefit`/`age-calculator`/
`bmi-calculator`/`military-salary`)의 import문·`faqItemsBySlug` 맵 항목이 순서·값
그대로 보존되어 있고, `housing-subscription-score` 항목은 import 목록 맨 끝(17행)과
맵 객체 맨 끝(42행)에 **추가만** 되었을 뿐 기존 9개 항목 사이에 삽입되거나 순서가
바뀐 곳이 없다 — 다른 계산기의 FAQPage JSON-LD 등록에 영향을 주지 않는다. 맵이
`as const` 객체 리터럴이고 `faqItems = faqItemsBySlug[slug as keyof typeof
faqItemsBySlug] ?? []`로 안전하게 접근하는 방식도 변경되지 않았다(97~98행). 개발
서버로 `/calculators/housing-subscription-score`를 curl해 응답 HTML에서
`"@type":"FAQPage"` 문자열이 실제로 포함됨을 확인했고, `md:grid-cols-2
lg:grid-cols-3`·`focus-within:ring-2 focus-within:ring-primary`·오류 help id
(`baseDate-help`) 문자열도 렌더링된 HTML에 그대로 나타나는 것을 확인해, 위 6가지
수정이 정적 분석뿐 아니라 실제 서버 렌더링 결과물에도 반영돼 있음을 재확인했다.

### 4. 새로운 문제 발생 여부

위 세 항목을 집중 검증하는 과정에서, 그리고 `ui.tsx` 전체를 다시 훑는 과정에서 이번
수정이 새로 만든 문제는 발견하지 못했다. 특히:

- `combineDescribedBy` 추가가 기존 helpText id 연결을 깨뜨리지 않았는지 8곳 전부 개별
  확인했다(각 필드의 help `<p id=...>`가 그대로 유지되고, `combineDescribedBy` 호출에
  그 id가 그대로 전달됨).
- `housingStatus` 라디오 3개가 동일한 오류/도움말 id 쌍을 공유하는 것은 단일 `<p
  id=...>`가 한 번만 렌더링되고 여러 `aria-describedby`가 그 하나의 id를 함께
  참조하는 유효한 패턴이라 문제 없음(중복 id 생성 아님).
- `focus-within:ring` 추가가 기존 `border`/`bg` 조건부 클래스(선택 상태 강조)와
  충돌하지 않는지 4곳 className 템플릿 리터럴을 직접 읽어 확인 — 별개의 유틸리티
  클래스라 충돌 없음.
- 카드 그리드 브레이크포인트 변경(`md:grid-cols-2 lg:grid-cols-3`)이 카드 내부
  `ItemScoreCard`/`WarningCard`/`space-y-3` 래퍼 구조 자체는 건드리지 않아, 2열
  단계(768~1023px)에서도 각 컬럼(`space-y-3`) 안에 카드→경고 카드가 세로로 쌓이는
  기존 배치 의도(ARCHITECTURE.md "6." Builder 판단)가 그대로 유지된다.

### 테스트 실행 결과

```
npx vitest run --no-file-parallelism (전체 스위트)
→ Test Files 47 passed (47) / Tests 467 passed (467)

npx vitest run src/calculators/housing-subscription-score --no-file-parallelism
→ Test Files 4 passed (4) / Tests 76 passed (76)

npx vitest run src/calculators/housing-subscription-score/ui.test.tsx --reporter=verbose --no-file-parallelism
→ 9/9 통과, console.error/console.warn 출력 없음(M-2 회귀 테스트 포함)

npx tsc --noEmit
→ 오류 0

npm run build (next build, Turbopack)
→ 성공, TypeScript 통과, 정적 페이지 생성 정상(15개 페이지)
```

전체 스위트가 이전 라운드(466개) 대비 1개 늘어난 467개로 Optimizer 보고와 정확히
일치하고, 회귀는 발견되지 않았다. `severance-pay`/`unemployment-benefit`/
`age-calculator` 등 회귀 대상 계산기는 이번 라운드에서 파일이 전혀 수정되지 않았고
(`logic.ts`/`policy.ts`도 미수정), 이미 전체 스위트 재실행으로 함께 확인됐으므로
별도 부분 실행을 반복하지 않았다(중복 방지, CLAUDE.md 요청 범위와 일치).

### 재검증 후 이슈 등급표

| 등급 | 라운드 1 이슈 | 재검증 결과 |
|---|---|---|
| Medium (M-1) | 4개 토글 그룹 키보드 포커스 표시 누락 | **해소 확인** — 4곳 전부 `focus-within:ring-2 focus-within:ring-primary` 적용 확인 |
| Medium (M-2) | `hasQualifyingSpouseInHousehold` 기본값 미동기화 | **해소 확인** — 코드 추적 + 런타임 재현으로 왕복/수동 오버라이드 보존 모두 확인 |
| Medium (M-3) | 오류 `aria-describedby` 미연결 | **해소 확인** — 8개 필드 전부 오류 id 연결, 렌더링 HTML에서도 확인 |
| Low (L-1) | 카드 그리드 브레이크포인트 문서 패턴 편차 | **해소 확인** — `md:grid-cols-2 lg:grid-cols-3`로 정확히 일치 |
| Low (L-2) | FAQPage JSON-LD 미등록 | **해소 확인** — 등록됨, 다른 9개 계산기 영향 없음 |
| Low (L-3) | 소수점 입력 무음 정제 | **해소 확인, 신규 위험 없음** — 전체 무시 방식이 DOM/상태 양쪽에서 일관되게 동작(런타임 재현으로 "표시 불일치" 가능성까지 직접 배제) |
| — | (신규 이슈) | 없음 |

### 최종 판정: **PASS**

- Critical: 0, High: 0.
- 라운드 1에서 지적한 Medium 3건·Low 3건 전부 코드 대조와 런타임 재현(스크래치패드
  React+jsdom 독립 스크립트, 소스 미변경)으로 실제 해소를 확인했다. 특히 우려했던
  두 지점 — (1) `isMarried` 동기화가 사용자의 수동 오버라이드를 부당하게 덮어쓰지
  않는지, (2) `onChange`에서 `setState`를 스킵하는 방식이 "화면 표시값과 내부 상태가
  어긋나는" 새로운 버그를 만들지 않는지 — 둘 다 이론적 우려만으로 끝내지 않고 실제
  React 런타임에서 재현해 문제 없음을 실증적으로 확인했다.
- 새로운 회귀나 새로운 이슈는 발견되지 않았다. `npx vitest run --no-file-parallelism`
  467/467, `npx tsc --noEmit` 오류 0, `npm run build` 성공을 재확인했다.
- `docs/EVALUATION.md` PASS 기준("Critical 0, High 0")을 충족하며, 이번 라운드는 추가
  개선 권고 없이 최종 PASS로 판정한다.
