# 디자인 시스템 / UI 공통 규칙

> 이 문서는 실제 구현(`app/globals.css`, `app/layout.tsx`, `components/calculator/*`,
> `src/calculators/severance-pay/ui.tsx`)을 기준으로 작성한다. 새 계산기를 만들 때는
> 아래 토큰/클래스를 그대로 재사용하고, `severance-pay`를 참고 구현으로 삼는다 —
> 새로운 색상·카드 스타일·아이콘 방식을 임의로 만들지 않는다.

## 디자인 토큰 (색상)
색상은 Tailwind 유틸리티 색상(`gray-500` 등)을 직접 쓰지 않고, `app/globals.css`에 정의된
CSS 커스텀 프로퍼티를 Tailwind v4 `@theme inline`으로 매핑한 시맨틱 토큰만 쓴다. `:root`가
라이트, `.dark`가 다크 값을 재정의한다(다크모드는 미디어쿼리가 아니라 `<html>`의 `.dark`
클래스로 제어 — 아래 "다크모드" 참고).

| 토큰(Tailwind 클래스) | 용도 |
|---|---|
| `bg-background` / `text-foreground` | 페이지 배경/기본 텍스트 |
| `bg-surface` | 카드·헤더·폼 등 배경(배경보다 한 단계 밝음/어두움) |
| `bg-surface-subtle` | 정책 안내처럼 은은하게 구분만 필요한 블록 |
| `bg-surface-strong` | 더 강한 대비가 필요한 표면 |
| `text-muted` | 보조 설명 텍스트(라벨 아래 help text, dt 등) |
| `border-border` / `border-border-strong` | 카드·구분선. 기본은 `border`, hover 시 `border-strong` |
| `bg-primary` / `hover:bg-primary-hover` / `text-primary-foreground` | 주요 액션 버튼, 핵심 결과 카드 배경 |
| `text-primary` / `bg-primary-soft` | 강조 텍스트(eyebrow 라벨), 아이콘 배지 배경 |
| `text-danger` | 에러 메시지 |
| `bg-warning-surface` / `border-warning-border` | "지급대상 아님" 류 경고 카드 |

새 색상이 필요하면 `globals.css`의 `:root`/`.dark`에 토큰을 추가하고 `@theme inline`에
매핑한 뒤 이 표에도 추가한다 — 컴포넌트에서 임의 hex나 Tailwind 기본 팔레트를 직접 쓰지 않는다.
(단, `zinc-500`/`zinc-400`류 회색 텍스트가 일부 기존 코드에 남아있는데 이는 `text-muted`로
점진적으로 통일해야 할 잔재다 — 새 코드에서는 반드시 `text-muted`를 쓴다.)

## 타이포그래피
- 페이지 h1: `text-3xl font-bold tracking-[-0.03em] sm:text-4xl` (계산기 상세 페이지),
  홈 히어로는 더 크게 `text-4xl sm:text-6xl tracking-[-0.045em]`.
- h1 위 eyebrow 라벨(카테고리 등): `text-sm font-semibold text-primary`.
- 본문 설명: `text-base leading-7 text-muted` (히어로는 `text-lg leading-8`).
- 카드 제목(`SectionCard` h2/h3): `text-base font-semibold tracking-tight`.
- 폼 라벨: `text-sm font-semibold tracking-tight`.
- 폰트: `next/font`의 Geist(본문/모노) + 한글 폴백 체인(`Pretendard Variable, Pretendard,
  "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic"`) — `app/globals.css`의 `body`에
  이미 설정되어 있으니 새 컴포넌트에서 폰트를 별도로 지정하지 않는다.

## 아이콘
**이모지가 아니라 인라인 SVG**를 쓴다(`viewBox="0 0 24 24" fill="none" stroke="currentColor"
strokeWidth="1.7"~"1.8"`, 크기는 `h-4 w-4`~`h-6 w-6`). `ThemeToggle`(해/달), `CalculatorCard`의
`CalculatorIcon`, `severance-pay/ui.tsx`의 `SectionIcon`이 모두 이 패턴이다. 새 아이콘이
필요하면 같은 stroke 스타일의 SVG를 직접 추가한다(외부 아이콘 라이브러리 의존 없음).
계산기 레지스트리의 `CalculatorMeta.icon`은 이모지 문자열이 아니라 **아이콘 이름 키**
(`"coins" | "calculator" | "calendar" | "chart" | "heart" | "utility"`)이며,
`CalculatorCard.tsx`의 `CalculatorIcon` 컴포넌트가 이 키를 실제 SVG로 매핑한다. 새 계산기가
기존 6개 키에 맞지 않는 아이콘이 필요하면 이 유니온 타입과 매핑 함수에 새 키를 추가한다.

## 공통 화면 순서
입력 → 결과 → 계산 근거(수식 breakdown) → 소개·사용 방법 → 정책 안내(계산 전제 고지) → FAQ.
(핵심은 항상 "입력 → 결과 → 계산 근거 → 정책 안내".) 소개=`IntroSection`, 사용방법=`UsageGuide`는
**결과·계산 근거 아래, 정책 안내 바로 위**에 배치한다 — SEO 목적상 개념 설명이 필요하긴 하지만,
이 사이트의 실제 계산기 대부분은 사용자가 먼저 입력·결과를 보고 필요하면 아래에서 설명을 찾는
흐름으로 통일돼 있다(2026-09-07 `loan-interest-calculator`에서 최초 발견·정정된 사례 참고 —
당시 이 문서 구버전이 "소개를 입력보다 앞에" 두라고 잘못 적혀 있었다). FAQ=`FaqAccordion`,
나머지 각 섹션은 `SectionCard`로 감싼다 — 넷 다 `components/calculator/`에 있는 공용
컴포넌트이므로 새로 만들지 않고 그대로 가져다 쓴다.

## 헤더(eyebrow) 라벨 — 반드시 카테고리 라벨과 정확히 일치시킨다
각 계산기 `ui.tsx`의 `<h1>` 바로 위에 작게 표시하는 말머리 문구(`text-sm font-semibold
text-primary`)는 **`registry.ts`의 `categoryLabels[calculator.category]` 값과 토씨 하나
틀리지 않고 그대로** 써야 한다(예: `category: "labor"`인 계산기는 반드시 "노동/근로", 새
줄임말·부제("노동 · 근로", "군 복무 · 급여" 등)를 임의로 지어내지 않는다). 이 문구는 홈페이지
`CategorySection`이 같은 계산기를 보여주는 카테고리 헤더(`{group.label}`, 역시
`categoryLabels`)와 시각적으로 대응해야 하는 자리라, 계산기마다 다른 표현을 쓰면 사용자가
홈에서 본 분류와 상세 페이지의 분류가 다르다고 느낀다(2026-09-13 전수 조사에서
`military-salary`가 카테고리 자체를 빼먹고 "군 복무 · 급여"만 쓰거나 `military-discharge-date`/
`business-days`가 같은 `date` 카테고리인데 "날짜 · 생활"/"날짜 · 업무"로 갈라져 있던 것을
발견·통일했다). `categoryLabels`는 이 값 자체를 코드에서 import해서 쓰는 것이 아니라
문자열로 그대로 옮겨 적는 관례이므로(client 컴포넌트가 `registry.ts`를 매번 import하지
않게 하기 위함), 새 계산기를 만들 때 이 문서나 `src/calculators/registry.ts`의
`categoryLabels`를 직접 확인하고 정확히 그 문자열을 복사해 쓴다.

## 카드/표면 패턴
- **기본 카드**(`SectionCard`): `rounded-2xl border border-border bg-surface p-6`. 왼쪽에
  선택적 아이콘 배지 `flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft
  text-primary`.
- **인터랙티브 카드**(`CalculatorCard`, 홈 목록): 기본 카드에 은은한 그림자와 hover 리프트를
  더한다 — `shadow-[0_14px_40px_-32px_rgba(16,24,40,.45)] transition hover:-translate-y-0.5
  hover:border-border-strong hover:shadow-[0_18px_45px_-28px_rgba(49,87,213,.35)]`.
- **폼 컨테이너**: `rounded-2xl border border-border bg-surface p-5 shadow-[0_16px_50px_-35px_
  rgba(16,24,40,.35)] sm:p-8`, 내부 구획은 `border-t border-border pt-5` 또는 `space-y-*`로
  나눈다.
- **핵심 결과 카드**(강조): 유일하게 배경을 채운 카드 — `rounded-2xl bg-primary p-6
  text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] sm:p-8`. 계산기당
  하나, 가장 중요한 숫자 하나만 여기 둔다.
- **경고/미충족 카드**("지급대상 아님" 등): `rounded-2xl border border-warning-border
  bg-warning-surface p-6`.
- **은은한 안내 블록**(정책 고지 등): `rounded-2xl bg-surface-subtle p-6`, 테두리 없음.

## 버튼
- 주요 액션: `rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground
  shadow-sm hover:bg-primary-hover`.
- 보조 액션(초기화·샘플): `rounded-xl border border-border px-4 py-3 text-sm font-semibold
  hover:border-border-strong hover:bg-surface-subtle`.

## 입력 UX
- 입력 공통 클래스: `rounded-xl border border-border bg-background px-3.5 py-3 text-sm
  shadow-sm outline-none transition focus:border-primary focus:bg-surface focus:ring-4
  focus:ring-primary/10` — 새 텍스트/숫자 입력은 이 클래스를 그대로 쓴다.
- 단위를 명시적으로 표시한다 (원, %, 년 등 — 라벨 옆에 `(단위)`로 표기).
- 금액 입력은 타이핑 중 실시간 천 단위 콤마를 표시한다(severance-pay의
  `handleAmountChange` 패턴 — 표시만 콤마, 검증/계산 전에 제거).
- 적절한 placeholder, `min`/`max`(날짜는 반드시 — 아래 "날짜 입력" 참고), decimal step.
- 사용자가 3.5%를 0.035로 직접 변환해서 입력해야 하는 UX는 금지 — 입력 표현(%)과 내부 계산
  표현(0.035)을 분리한다.
- 모바일에서 숫자 키패드가 뜨도록 `inputMode="numeric"`(정수) 또는 `"decimal"`(소수 허용)을
  쓴다.
- 필수/선택 여부를 라벨에 `*`(필수, 빨간색) 또는 `(선택)`로 명시한다.

## 입력 라벨·순서
입력 폼은 "계산법을 모르는 일반 사용자"가 막힘 없이 채울 수 있어야 한다. 라벨·순서를 정할 때는
`src/calculators/severance-pay/ui.tsx`의 `FIELDS` 배열을 기준 예시로 삼아 직접 대조한다
(입사일 → 퇴사일 → 금액 순서, 전부 일상어 라벨).

### 라벨 표현
- 라벨은 법령 용어·전문 용어가 아니라 **일반 사용자가 실제로 쓰는 표현**으로 쓴다. 예: "이직일"
  (고용보험법 문언) → "퇴사일", "고용보험 가입 시작일" → "입사일". 다른 계산기 사이트에서
  통용되는 표현이 있으면 그쪽을 우선한다.
- 정확한 법령 용어가 필요하면 라벨이 아니라 helpText에 넣는다. 예: 라벨은 "퇴사일", helpText에
  "고용보험법상 '이직일'과 같습니다".
- `FORMULA.md`·`SPEC.md`의 용어를 화면 라벨로 그대로 복사하지 않는다 — 그 문서들은 법적 정확성
  기준으로 작성되며, 화면 라벨로 옮길지는 별도 판단이다.
- 같은 개념은 폼·결과·오류 메시지 전체에서 한 용어로 통일한다(예: "퇴사일"로 정했으면 "이직 전
  3개월"이 아니라 "퇴사 전 3개월", 검증 오류 메시지도 동일 용어).

### 입력 순서·그룹핑
- 날짜 입력은 **시간 순서대로** 배치한다(입사일 → 퇴사일, 시작일 → 종료일).
- 하나의 기간을 이루는 두 날짜(입사일·퇴사일 등) 사이에 성격이 다른 필드를 끼워 넣지 않는다 —
  관련된 필드는 인접시킨다.
- 두 필드로부터 값이 자동 계산되는 경우(예: 두 날짜 → 기간), 그 두 필드를 붙여 놓고 자동 계산
  결과 미리보기도 바로 아래에 둔다.
- 입력 필드 수는 최소화한다 — 한 값을 다른 입력에서 유도할 수 있으면(나이 ← 생년월일) 사용자가
  더 답하기 쉬운 쪽 하나만 받는다.

## 날짜 입력
`<input type="date">`는 `min`/`max` 속성을 반드시 지정한다 — Chromium 계열 브라우저는
`min`/`max`가 없으면 연도 서브필드에 4자리를 넘는 입력(예: "123411")을 억제하지 않는다
(2026-09-02 실사용자 버그 리포트로 확인). `min`/`max`는 브라우저 UI 힌트일 뿐 값 자체를
강제하지 않으므로, 검증 로직(validation.ts)에서도 반드시 같은 범위를 다시 검사한다
(severance-pay의 `MIN_ALLOWED_DATE`/`getMaxAllowedDate()` 패턴 참고 — 최솟값은 계산기
성격에 맞는 합리적 하한, 최댓값은 오늘 기준 동적 상한).

## Reset / Sample
모든 계산기는 초기화 기능을 제공하고, 필요하면 합리적인 샘플 값을 제공한다(가능하면
FORMULA.md의 검증 예제 값을 그대로 사용해 "이 값을 넣으면 이 결과가 나와야 한다"는 것이
샘플 자체로 검증되게 한다).

## 공유

계산 전·후 모두 `components/calculator/ShareActions.tsx`를 사용한다. 계산 전에는 계산기 URL과
소개 문구를, 계산 후에는 복원 가능한 결과 URL과 핵심 결과 문구를 전달한다. 채널·URL·개인정보
처리 규칙과 카카오 운영 설정은 [SHARING.md](SHARING.md)를 따른다. 계산기별로 공유 버튼이나
SNS 아이콘을 다시 구현하지 않는다.

## 모바일
최소 320px, 375px, 390px, 768px, 1440px에서 검증한다. 확인 항목: 입력 필드 잘림 없음, 숫자
키패드, 충분한 터치 영역, 결과 한눈에 보임, 가로 스크롤 없음. 카드 그리드는
`grid-cols-1 md:grid-cols-2 lg:grid-cols-3` 패턴을 쓴다.

## 접근성
- 모든 input에 label 연결(`htmlFor`/`id`), 오류는 `role="alert"` + `aria-describedby`로
  입력과 연결.
- 결과가 갱신되는 영역은 `aria-live="polite"`로 감싼다(결과 섹션 전체, 그리고 체크박스 등
  토글에 따라 조건부로 바뀌는 안내 문구도 포함).
- 아코디언(FaqAccordion)은 버튼에 `aria-expanded`/`aria-controls`, 패널에
  `role="region"`+`aria-labelledby`. 펼침 상태를 아이콘 회전만이 아니라 `aria-expanded`로도
  전달한다(색상/아이콘만으로 상태 표현 금지).
- `:focus-visible`은 전역으로 `outline: 2px solid var(--primary); outline-offset: 3px`
  (`globals.css`) — 개별 컴포넌트에서 outline을 제거하지 않는다.
- 명도 대비 WCAG AA 이상(다크모드 포함) — 위 색상 토큰은 이미 AA를 만족하도록 값이
  정해져 있으므로, 토큰을 벗어난 임의 색상을 쓰지 않는 한 자동으로 지켜진다.

## 다크모드
`prefers-color-scheme` 미디어쿼리가 아니라 `<html>`의 `.dark` 클래스로 제어한다(사용자가
라이트/다크를 직접 토글할 수 있어야 하므로). `app/layout.tsx`의 인라인 스크립트가 hydration
전에 `localStorage["theme"]`(없으면 시스템 설정)를 읽어 클래스를 먼저 설정해 깜빡임(FOUC)을
막고, `components/theme-toggle.tsx`가 이후 토글과 저장을 담당한다. 테마에 따라 달라지는
아이콘 등은 React state로 관리하지 말고(hydration mismatch/추가 렌더 유발) `dark:hidden` /
`hidden dark:inline` 같은 CSS 클래스 전환으로 처리한다(`theme-toggle.tsx` 패턴 참고). 사이트
전체에 기본 제공하며, 새 컴포넌트는 색상을 토큰으로만 쓰면 다크모드 대응이 자동으로 된다.

## 참고 구현
새 계산기의 UI를 만들 때는 아래를 그대로 참고한다:
- `src/calculators/severance-pay/ui.tsx` — 화면 전체 구조, 폼/결과/계산근거 조합 예시
- `components/calculator/{SectionCard,UsageGuide,IntroSection,FaqAccordion}.tsx` — 재사용
  컴포넌트, 새로 안 만들고 가져다 쓴다
- `components/calculator/CalculatorCard.tsx`, `CategorySection.tsx` — 홈/카테고리 목록 카드
- `app/globals.css` — 전체 토큰 정의
