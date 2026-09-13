# ARCHITECTURE: 만 나이 계산기

## 파일 구조

```text
src/calculators/age-calculator/
  types.ts        입력·정확한 나이·결과 타입
  date-utils.ts   시간대 없는 날짜·기념일·요일 계산
  logic.ts        만 나이와 보조 결과 순수 계산
  validation.ts   날짜 형식·범위·선후관계 검증
  formatting.ts   날짜·기간·D-day 표시
  content.ts      FAQ·SEO 콘텐츠
  zodiac.ts       간지·오행·색상·십이지 매핑
  calendar-data/  설날·입춘 한국천문연구원 검증 스냅샷
  ui.tsx          입력·결과 UI
  *.test.ts(x)    날짜·로직·검증·UI 테스트
```

## 핵심 타입

```ts
type AgeCalculatorInput = {
  birthDate: string;
  referenceDate: string;
};

type CalendarAge = {
  years: number;
  months: number;
  days: number;
};

type AgeCalculatorResult = {
  birthDate: string;
  referenceDate: string;
  fullAge: number;
  calendarAge: CalendarAge;
  daysSinceBirth: number;
  koreanCountingAge: number;
  yearAge: number;
  birthdayState: "before" | "today" | "passed";
  nextBirthday: string;
  daysUntilBirthday: number;
  birthWeekday: number;
  referenceWeekday: number;
  zodiac: {
    standard: "lunar-new-year" | "ipchun";
    ganzhi: string;
    heavenlyStem: string;
    earthlyBranch: string;
    element: "wood" | "fire" | "earth" | "metal" | "water";
    colorLabel: string;
    animal: string;
    displayName: string;
  };
};
```

## 결정

- 만 나이·경과기간 계산에는 외부 날짜 라이브러리를 사용하지 않는다.
- 띠 계산에는 한국천문연구원 기준 변환표를 오프라인으로 내장하고 간지 인덱스를 제공하는
  `korean-lunar-calendar` 0.4.0을 사용한다. 런타임 의존성은 없으며 양력 지원 범위는
  1000-02-13~2050-12-31이다. 제품에서는 공식 검증 범위와 전체 입력 정책을 고려해 띠 제공
  범위를 1900-01-01~2050-12-31로 제한한다.
- 입력은 `YYYY-MM-DD` 문자열로 유지하고 브라우저의 `new Date("YYYY-MM-DD")` 해석에 의존하지
  않는다.
- 날짜 차이는 `Date.UTC`로 만든 정수 day serial만 사용한다.
- 연·월 덧셈은 대상 월에 같은 일자가 없으면 말일로 제한하는 순수 함수를 사용한다.
- 현재 날짜는 계산 로직 안에서 읽지 않고 UI가 Asia/Seoul 기준 문자열로 주입한다.
- 만 나이, 정확한 경과기간, D-day와 참고 나이를 한 순수 함수에서 같은 날짜 경계로 계산한다.
- 띠 로직은 만 나이 계산과 분리하고, 검증된 설날·입춘 스냅샷과 순수 매핑만 사용한다.
- v1 기본 띠 계산에는 출생일만 사용하며 음력 설날 기준만 제공한다. 입춘 기준은 경계 당일의
  정확성을 위해 출생 시각과 절입 시각 데이터가 준비된 후 추가한다.
- 런타임 외부 API 호출 없이 한국 음력 변환 데이터를 번들에 포함해 오프라인으로 계산한다.
- 레지스트리는 Builder 완료 시 draft로 등록하고 감사·QA 후 published로 전환한다.

## UI 구성

1. 제목과 짧은 설명
2. 생년월일·기준일 입력 카드
3. 만 나이 핵심 결과 카드
4. 입력 정보와 추가 결과
5. 만 나이·세는나이·연 나이 비교
6. 띠·간지 카드와 기준 전환
7. 실제 날짜가 대입된 계산 방법
8. 법적 기준과 예외 안내
9. FAQ

참고 화면의 결과 밀도는 유지하되 이모지는 사용하지 않는다. 생일 상태는 사이트 공통 SVG
아이콘 또는 텍스트 배지로 표현한다. 결과 카드는 라이트·다크 모드 모두 `surface`,
`primary-soft`, `primary` 토큰을 사용한다.

## 테스트 경계

- 법제처 공식 예시 2개
- 생일 전날·당일·다음 날
- 출생 당일과 만 1세 미만 월수 표시
- 2월 29일생의 윤년·평년 경계
- 28·29·30·31일 출생자의 월말 경과기간
- 1900·2200 지원 경계
- 음력 설날 전날·당일과 60갑자 순환
- 천간별 오행·색상과 지지별 동물 매핑
- 잘못된 날짜와 기준일 역전
- Asia/Seoul 오늘 기본값과 결과 `aria-live`
