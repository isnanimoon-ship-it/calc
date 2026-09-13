# ARCHITECTURE: 육아휴직급여 계산기

## 파일 구조

```text
src/calculators/parental-leave-benefit/
  policy.ts       시행일별 지급률·상한·하한과 특례 정책 SSOT
  types.ts        입력·월별 구간·결과 타입
  date-utils.ts   급여월 분할과 날짜 연산
  logic.ts        순수 급여 계산
  validation.ts   입력·유형별 조건 검증
  formatting.ts   금액·날짜·기간 표시
  content.ts      정책 안내·FAQ·SEO 데이터
  ui.tsx          입력·결과·상세 내역 UI
  *.test.ts(x)    정책·날짜·검증·UI 테스트
```

## 핵심 타입

```ts
type BenefitScheme = "general" | "parents-together" | "single-parent";

type BenefitInput = {
  startDate: string;
  leaveMonths: number;
  ordinaryWageWon: number;
  scheme: BenefitScheme;
  priorLeaveMonths: number;
  childBirthDate?: string;
  spouseLeaveMonths?: number;
  spouseLeaveStatus?: "used" | "planned";
  extensionEligibility?: "both-parents" | "single-parent" | "disabled-child";
};

type BenefitSegment = {
  benefitMonth: number;
  startDate: string;
  endDate: string;
  leaveDays: number;
  denominatorDays: number;
  policy: "general-1-3" | "general-4-6" | "general-7-plus"
    | "parents-together" | "single-parent-1-3";
  rateBps: number;
  capWon: number;
  floorWon?: number;
  fullMonthWon: number;
  finalWon: number;
};
```

## 결정

- 통상임금과 지급액은 안전한 정수 범위의 `number` 원 단위로 계산하고, 비율은 정수
  퍼센트로 보관한다. 입력 상한 10억원과 최대 18개월 합계는 `Number.isSafeInteger` 범위에
  충분히 들어오므로 별도 decimal 의존성을 추가하지 않는다.
- v1은 완전한 달력 개월만 계산하고 검증되지 않은 부분월 산식을 구현하지 않는다.
- JavaScript 로컬 `Date` 연산을 사용하지 않고 연·월·일 구조체와 UTC day serial을 사용한다.
- 정책 데이터, 기간 분할, 금액 계산, UI 표시를 각각 분리한다.
- `calculateBenefit`은 현재 날짜나 브라우저 상태를 읽지 않는 순수 함수로 만든다.
- 월별 `BenefitSegment[]`가 계산의 SSOT이며 총액·소계·표·계산 과정은 모두 같은 배열에서 만든다.
- 특례 자격은 로직이 추론하지 않고 명시적인 사용자 입력과 검증 결과로 받는다.
- Formula Gate를 통과했으며 Builder는 완전월 지원 범위를 벗어나지 않게 구현한다.

## 정책 데이터

정책 항목은 값과 함께 `effectiveDate`, 법령 조문, URL, `lastVerified`, `nextReviewDue`를 가진다.
현재 계산기에 필요한 수치는 전역 정책 파일을 무리하게 확장하지 않고 계산기 전용 `policy.ts`에
두되, 공통 재검토 도구가 읽을 수 있는 동일 메타데이터 스키마를 사용한다.

## UI 구성

1. 계산기 소개와 정책 기준 배지
2. 기본 입력
3. 유형 선택 및 조건부 특례 입력
4. 자격 확인 체크리스트
5. 핵심 결과 카드
6. 구간별 소계와 월별 상세 내역
7. 실제 값이 대입된 계산 과정
8. 자격·신청·정책 안내와 FAQ

월별 내역은 데스크톱 표와 모바일 카드가 동일 데이터를 사용한다. 다크 모드 핵심 결과는 강한
단색 배경 대신 기존 사이트의 어두운 표면, 얇은 테두리와 제한된 강조색을 사용한다.

## 테스트 경계

- `policy.test.ts`: 시행일, 지급월별 요율·상한·하한
- `date-utils.test.ts`: 월말, 윤년, 완전월, 12·18개월 경계
- `logic.test.ts`: 일반·부모 함께·한부모·연장 및 합계 불변식
- `validation.test.ts`: 유형별 누락·범위·정책 시작일
- `ui.test.tsx`: 조건부 입력, 오류 연결, 계산 결과, 접근성

핵심 불변식은 `총액 = 모든 segment.finalWon의 합`, `각 segment는 완전한 급여월`,
`특례 적용 개월 ≤ 6`, `전체 누적기간 ≤ 18개월`이다.
