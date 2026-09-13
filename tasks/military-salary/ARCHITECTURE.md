# ARCHITECTURE: 군인 월급 계산기

## 파일 구조

```text
src/calculators/military-salary/
  policy.ts       연도별 봉급·복무기간·적금 정책
  types.ts        입력, 계급 구간, 적금 및 결과 타입
  date-utils.ts   시간대 없는 복무월·진급일 계산
  logic.ts        봉급·적금 순수 계산
  validation.ts   조건부 입력과 진급일 검증
  formatting.ts   원·날짜·개월 표시
  content.ts      기준 안내, FAQ, SEO
  ui.tsx          입력·결과·상세 UI
  *.test.ts(x)    정책·공식·검증·UI 테스트
```

## 핵심 모델

```ts
type ServiceType = "army" | "navy" | "air-force" | "marine" | "full-time-reserve";
type Rank = "private-2" | "private-1" | "corporal" | "sergeant";

type MilitarySalaryInput = {
  policyYear: 2026;
  serviceType: ServiceType;
  enlistmentDate: string;
  mode: "full-service" | "to-reference-date";
  referenceDate?: string;
  promotionDates?: Partial<Record<Exclude<Rank,"private-2">,string>>;
  savings: { enabled:false } | {
    enabled:true;
    monthlyContributionWon:number;
    contributionMonths:number;
    expectedAnnualRateBps:number;
  };
};

type RankSalarySegment = {
  rank: Rank;
  months: number;
  monthlyPayWon: number;
  subtotalWon: number;
  estimated: boolean;
};
```

## 설계 결정

- 정책값은 `policy.ts` 한 곳에서 시행연도·출처·검토일과 함께 관리한다.
- 결과의 SSOT는 `RankSalarySegment[]`이며 총 봉급과 표는 이 배열을 합산한다.
- 금액은 안전한 정수 범위의 원 단위 `number`, 금리는 basis point 정수로 보관한다.
- 적금은 discriminated union으로 모델링해 미가입 상태에 잘못된 납입값이 섞이지 않게 한다.
- 봉급 총액, 적금 원금, 이자 추정, 매칭지원금, 복무 중 사용 가능액을 별도 필드로 유지한다.
- `calculateMilitarySalary`는 현재 시각·DOM·URL을 읽지 않는 순수 함수로 만든다.
- 전역일은 기존 `military-discharge-date`의 날짜 유틸과 정책을 공통 모듈로 추출하거나 동일한
  검증된 구현을 재사용한다. 복무기간 값을 두 계산기에 중복 하드코딩하지 않는다.

## UI 상태

- 복무형태 변경 시 허용 복무개월과 적금 최대 납입개월을 다시 검증한다.
- 적금 미가입으로 변경하면 납입액·개월·금리 입력을 결과 및 공유 상태에서 제거한다.
- 고급 설정의 실제 진급일을 닫아도 입력값은 유지하되 `기본 일정 사용`으로 초기화할 수 있다.
- 모바일에서는 결과표를 계급별 카드로 전환한다.

## 테스트 분리

- `policy.test.ts`: 2026 봉급표, 복무형태별 개월, 적금 한도·매칭률
- `date-utils.test.ts`: 월말, 윤년, 진급일과 전역일
- `logic.test.ts`: 계급 소계, 합계 불변식, 적금 만기자산
- `validation.test.ts`: 5만원 단위, 개월 상한, 진급일 순서
- `ui.test.tsx`: 조건부 적금 입력, 상세표, 경고, 공유 복원
