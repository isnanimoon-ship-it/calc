# ARCHITECTURE: 연봉 실수령액 계산기 (annual-salary-take-home-pay)

Architect 구조 결정 메모. 승인된 `SPEC.md` · `FORMULA.md` 기준. 작성일 2026-09-06.
계산 공식 자체는 바꾸지 않는다(4대 보험 요율·상하한, 근로소득세 산식, 지방소득세율은
FORMULA.md가 확정한 그대로다). 여기서는 코드 배치, 타입, 데이터 경계, UI 구조만 정한다.

관련 문서: `docs/ARCHITECTURE.md`, `docs/CALCULATOR_RULES.md`, `docs/DESIGN_SYSTEM.md`.
참고 선례: `tasks/four-major-insurance/ARCHITECTURE.md`(4대 보험 공식·데이터 구조),
`tasks/business-days/ARCHITECTURE.md`(대용량 연도별 스냅샷 데이터 배치, `holidays.ts` 패턴),
`tasks/housing-subscription-score/ARCHITECTURE.md`(계산기 전용 `policy.ts` 선례, Architect가
`policy.ts`/데이터 파일을 직접 채우지 않고 스키마만 문서에 남기는 관례),
`docs/ARCHITECTURE.md` "날짜 계산 유틸 공용화"(공용 로직을 `src/lib/`로 추출하는 절차).

**정정 사항(2026-09-06, Builder/Calculation Auditor 확인)**: 이 문서 전체가 근로소득세 고소득
구간("3. 정책 데이터 스키마", "2. 대용량 근로소득 간이세액표..." 등)을 "1억원 초과"라고
표기하는데, 실제로는 **10,000천원 = 10,000,000원 = 1천만원**이며 1억원이 아니다("천원"을
"만원"으로 착각한 단위 환산 오류). 이 오기 때문에 이 문서의 `policy.ts` 스키마 초안(아래
"3.")도 구간 경계값을 실제보다 10배 크게(`minWon: 100_000_000` 등) 적어 뒀었다 — Builder가
FORMULA.md 원문(천원 단위 그대로 × 1,000)과 실제 세액표 데이터의 `range.maxWon`
(10,000,000)을 근거로 이 오류를 발견해 `policy.ts`에서 올바른 값(`minWon: 10_000_000` 등)으로
정정했고, Calculation Auditor가 law.go.kr 원문 재확인으로 이 정정이 맞음을 확인했다(상세는
`tasks/annual-salary-take-home-pay/EVALUATION.md`와 `src/calculators/annual-salary-take-home-pay/policy.ts`
상단 주석 참고). **아래 본문의 "1억원"이라는 표현은 이 문서가 작성된 시점의 착오를 그대로
보존한 것이며, 실제 코드는 이미 "1천만원" 기준으로 정확히 구현되어 있다** — 이 메모를
구조 결정의 이력으로 남기되, 실제 수치를 참고할 때는 이 정정 사항과 `policy.ts` 주석을
우선한다.

---

## 0. 레지스트리 상태 확인

`src/calculators/registry.ts` 교차 확인 결과 `annual-salary-take-home-pay` slug는 아직
등록되어 있지 않다. 기존 관례대로 이번 Architect 라운드에서도 등록하지 않는다 — 아래
"8. 계산기 등록 전략" 참고.

---

## 1. 핵심 결정 — 4대 보험 근로자 부담분 재사용 방식

### 결론: (C) 근로자 부담분 계산만 `src/lib/social-insurance.ts`로 추출해 두 계산기가 공유한다

(A) `calculateFourMajorInsurance`를 그대로 호출, (B) 독립 재구현, (C) 공용 함수 추출 세
선택지 중 **(C)**를 선택한다.

### (A)를 채택하지 않는 이유 — 단순 "결합을 어떻게 볼 것인가"를 넘어서는 실질적 문제

`src/calculators/four-major-insurance/logic.ts`를 직접 읽어 확인한 결과, **근로자 부담분
네 금액(`employeePension`/`employeeHealth`/`employeeLongTermCare`/`employeeEmployment`)은
전부 `employmentBusinessRateTier`에 의존하지 않는다** — 이 필드는 오직 사업주 부담분
(`employerExtraRates`)에만 쓰인다. 즉:

- (A)를 택하면 이 계산기는 자신의 계산 결과에 **아무 영향도 주지 않는** 값
  (`nationalPensionEnabled: true`, `healthInsuranceEnabled: true`,
  `employmentInsuranceEnabled: true`, `employmentBusinessRateTier: "under150"` 등)을 타입을
  만족시키기 위해서만 채워 넣어야 한다. 이는 "값이 결과에 영향을 주지 않으니 아무거나
  넣어도 된다"는 논리가 아니라, **`FourMajorInsuranceInput`이라는 타입의 경계 자체가 이
  계산기의 실제 필요보다 넓다**는 신호다 — 코드 스멜로 취급해야 한다.
- 이 가짜 의존성은 진짜 결합 비용을 만든다: `four-major-insurance`가 향후 사업주 부담
  관련 개념(예: 산재보험 업종 코드 등)을 위해 `FourMajorInsuranceInput`에 새 **필수**
  필드를 추가하면, 근로자 부담분과 전혀 무관한 이 계산기도 컴파일 타임에 함께 깨진다.
  이는 "기능적으로 아무 관련이 없는데 타입 때문에 강제로 같이 움직여야 하는" 나쁜 결합이다.
- 반환값도 마찬가지다 — `FourMajorInsuranceResult`에는 `workersCompensation`,
  `employerInsuranceTotalExcludingWorkersComp`, `combinedInsuranceTotalExcludingWorkersComp`,
  `employmentBusinessRateTier` 등 **SPEC "범위 밖"으로 명시한 사업주 부담 개념**이 그대로
  섞여 나온다. 이 계산기의 `logic.ts`를 읽는 사람이 "왜 사업주 부담을 계산해놓고 안
  쓰지?"를 매번 다시 확인해야 하는 인지 비용이 생긴다.

### (B)를 채택하지 않는 이유

FORMULA.md는 "세율표·상하한을 다시 조사하지 않는다"고 명시했다 — (B)도 `rates-2026.json`의
같은 `socialInsurance` 값을 읽으므로 이 요구는 지키지만, **산술 구현 자체**
(`applyRate`의 절사 순서, 건강보험 총액 상하한 clamp 후 50% 분할, 장기요양보험을
확정 건강보험료로부터 유도하는 계산)를 두 파일에 복붙하게 된다. `docs/ARCHITECTURE.md`
"날짜 계산 유틸 공용화" 결정 사례가 정확히 이런 상황("두 계산기가 동일한 법적 정의를
공유")을 겨냥해 만들어졌다 — 두 사본 중 하나만 나중에 수정되는 드리프트 위험(예: 향후
건강보험 단수 처리 순서가 재검토될 때 한쪽만 고치는 실수)을 감수할 이유가 없다.

### (C) 구현 방식 — `src/lib/social-insurance.ts` (신규, `date-calc.ts`와 같은 급의 공용 파일)

**이번 라운드에서 이 파일을 실제로 만들지 않는다** — 계산 로직이 담긴 파일이라 Builder
몫이다(아래 계약만 확정). `src/lib/date-calc.ts`가 "순수 날짜 산술만 다루고 도메인 판정은
호출부에 남긴다"는 원칙을 세운 것과 같은 방식으로, 이 파일은 **"근로자 부담분 산정"이라는
좁고 도메인 의미가 고정된 계산만 다루고, 가입 여부 on/off·사업주 부담·사업장 규모 같은
`four-major-insurance` 고유 개념은 다루지 않는다.**

```ts
// src/lib/social-insurance.ts (Builder 작성 — 계약만 아래에 확정)
// four-major-insurance/logic.ts의 근로자 부담분 계산을 "그대로 이동"한다(재작성 금지).

export interface EmployeeSocialInsuranceInput {
  monthlyGrossPay: number;      // 원
  monthlyNonTaxablePay: number; // 원
}

export interface EmployeeSocialInsuranceCoreResult {
  estimatedMonthlyRemuneration: number;  // monthlyGrossPay - monthlyNonTaxablePay
  pensionStandardMonthlyIncome: number;  // 상하한 적용 후 기준소득월액
  employeePension: number;
  healthTotalClamped: number;            // 건강보험 상하한 적용 후 "근로자+사업주 합계"
                                          // — four-major-insurance가 employer = healthTotalClamped
                                          //   - employeeHealth로 역산할 때만 필요, 이 계산기는 안 씀
  employeeHealth: number;
  employeeLongTermCare: number;
  employeeEmployment: number;            // 고용보험 실업급여 근로자 부담(사업장 규모 무관, 항상 확정)
  employeeInsuranceTotal: number;        // 위 네 값의 합
  pensionMinimumApplied: boolean;
  pensionMaximumApplied: boolean;
  healthMinimumApplied: boolean;
  healthMaximumApplied: boolean;
  appliedRateYear: 2026;
  appliedRatePeriod: "2026-07-01/2027-06-30";
}

export function truncateTo10Won(value: number): number;

export function calculateEmployeeSocialInsuranceContributions(
  input: EmployeeSocialInsuranceInput,
): EmployeeSocialInsuranceCoreResult;
```

**`four-major-insurance/logic.ts` 리팩터링 방식 (Builder, 회귀 위험 관리 절차 — 날짜 계산
유틸 공용화 사례와 동일 절차를 그대로 따른다)**:

1. 위 네 근로자 부담 계산(기준소득월액 clamp, `employeePension`, 건강보험 총액 clamp 후
   50% 분할, 장기요양보험 유도, 고용보험 근로자 부담)을 **한 글자도 바꾸지 않고**
   `calculateEmployeeSocialInsuranceContributions`로 이동한다.
2. `calculateFourMajorInsurance(input): FourMajorInsuranceResult`의 **공개 시그니처와
   반환값 구조는 그대로 유지**한다 — 내부에서 위 공용 함수를 호출한 뒤, 가입 여부 on/off
   판정(`excluded(...)`)과 사업주 부담분(국민연금 사업주 기여금, 건강보험
   `healthTotalClamped - employeeHealth`, 장기요양 사업주 몫, 고용보험 사업주 몫 +
   `employerExtraRates`)만 `logic.ts`에 남겨 계산한다.
3. `truncateTo10Won`은 현재 `four-major-insurance/logic.ts`에서 `export`돼 있지만
   저장소 전체에서 다른 파일이 import하지 않음을 확인했다(grep 결과 `logic.ts`/
   `logic.test.ts` 자기 자신만). 이동 후 `four-major-insurance/logic.ts`에
   `export { truncateTo10Won } from "@/src/lib/social-insurance";`로 재노출해 기존
   공개 이름을 보존한다(비용이 거의 없으므로 굳이 제거하지 않는다).
4. 리팩터링 직후 `four-major-insurance/logic.test.ts`(기존 12개 이상 Golden Test,
   `calculateFourMajorInsurance`만 블랙박스로 호출하는 구조임을 확인함)를 **그대로
   재실행**해 회귀가 없음을 확인한다. `npx tsc --noEmit`도 함께 확인한다.
5. (선택, 권장) `src/lib/social-insurance.test.ts`를 추가해 두 계산기가 공유하는 계약을
   함수 레벨에서 고정한다 — `src/lib/date-calc.test.ts`가 순수 산술 계약을 별도로
   검증하는 것과 같은 성격. FORMULA.md 예제 1(월급여 3,000,000원 → 국민연금 142,500 /
   건강보험 107,850 / 장기요양 14,170 / 고용보험 27,000, 합계 291,520원)을 최소 1개
   포함한다(`four-major-insurance` FORMULA.md 예제 1과 이 계산기 FORMULA.md 예제 1이
   동일 값이므로 교차 검증도 겸한다).

**`annual-salary-take-home-pay/logic.ts`에서의 사용(Builder, 계약만)**:

```ts
const core = calculateEmployeeSocialInsuranceContributions({
  monthlyGrossPay,        // FORMULA 1단계: floor(annualSalary / 12)
  monthlyNonTaxablePay,
});
// core.employeePension / employeeHealth / employeeLongTermCare / employeeEmployment /
// core.employeeInsuranceTotal / core.pensionStandardMonthlyIncome /
// core.pensionMinimumApplied / pensionMaximumApplied / healthMinimumApplied /
// healthMaximumApplied 를 FORMULA.md 출력값 표 그대로 결과에 매핑한다.
// core.healthTotalClamped, core.appliedRatePeriod 등 이 계산기가 안 쓰는 필드가 있어도
// 무방하다 — 공유 계약의 일부일 뿐 강제 사용 의무는 없다.
```

이 계산기는 `employmentBusinessRateTier`, 가입 여부 on/off라는 개념 자체를 **한 번도
언급하지 않는다** — SPEC "v1 전제와 범위"(4대 보험 항상 전체 가입)와 정확히 일치한다.

### 이 결정을 `docs/ARCHITECTURE.md`에 새 결정 사례로 기록하는 이유

기존 "날짜 계산 유틸 공용화" 결정 사례는 `src/lib/`를 **날짜 산술** 전용으로 한정해
써왔다(`date-calc.ts`). 이번이 **금액/보험료 계산**을 `src/lib/`로 추출하는 첫 사례라,
"날짜 산술뿐 아니라 도메인이 고정된 순수 계산이면 금액 계산도 같은 방식으로 공용화한다"는
일반 원칙을 명시적으로 확장해 기록할 가치가 있다. `docs/ARCHITECTURE.md`에 결정 사례를
추가했다(아래 "문서 갱신" 참고).

---

## 2. 핵심 결정 — 대용량 근로소득 간이세액표 데이터 파일 설계

### 파일 위치: `src/data/withholding-tax-table-2026.json` (FORMULA.md 제안 그대로)

`src/data/holidays/{year}.json`(영업일 계산기, 연도별 대용량 원본 스냅샷) 선례를 그대로
따른다 — "연도별로 갱신되는 대용량 1차 출처 원문 스냅샷"이라는 성격이 공휴일 데이터와
동일하다. `rates-2026.json`에 합치지 않는 이유:

- `rates-2026.json`의 각 항목은 `{value, unit, source, lastVerified, nextReviewDue}`
  구조(`docs/CALCULATOR_RULES.md` "데이터 파일 스키마")를 항목 하나하나에 적용한다. 이
  스키마를 1,840행 × 11열(약 20,000개 셀)에 그대로 적용하면 무의미하게 커지고, "행 하나 =
  법정 세액표의 한 구간"이라는 실체를 스키마가 가리게 된다.
- `holidays/{year}.json`도 정확히 같은 이유로 파일 레벨 메타데이터(`year`, `status`,
  `reviewedAt`)만 갖고 행 배열(`holidays: [date, name, kind][]`)은 메타데이터 없는 순수
  튜플이다 — 이 파일도 동일 패턴을 따른다(새로운 원칙이 아니라 기존 홀리데이 스냅샷
  패턴을 그대로 적용).

### 이 파일이 CALCULATOR_RULES.md "데이터 파일 스키마"를 따르는지

**파일 레벨에서는 따르고, 행(row) 레벨에서는 따르지 않는다.** 즉 파일 전체를 대표하는
출처 메타데이터(`source`, `lastVerified`, `nextReviewDue`, `effectiveFrom`)는 최상위에
한 번만 두고, 1,840개 행 각각에는 이 메타데이터를 반복하지 않는다 — "순수 룩업 데이터는
다른 스키마를 써도 되는가"라는 질문에 대한 답은 "파일 전체 단위로는 같은 스키마를 쓰되,
셀 단위로 내려가지 않는다"이다.

### 행(row) 스키마 — 조회 성능보다 "파싱 정확성 검증 용이성"을 우선한다

```json
{
  "effectiveFrom": "2026-03-01",
  "source": {
    "law": "소득세법 시행령 [별표 2]",
    "article": "제189조제1항 관련, 2026. 2. 27. 개정",
    "effectiveDate": "2026-03-01",
    "url": "https://www.law.go.kr/LSW/flDownload.do?flSeq=164357181&bylClsCd=110201"
  },
  "lastVerified": "2026-09-06",
  "nextReviewDue": "2027-01-01",
  "familyCountColumns": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  "range": { "minWon": 770000, "maxWon": 10000000 },
  "rows": [
    { "minWon": 770000, "maxWon": 772000, "taxByFamilyCount": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0, "11": 0 } },
    { "minWon": 1060000, "maxWon": 1065000, "taxByFamilyCount": { "1": 1040, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0, "11": 0 } },
    { "minWon": 3000000, "maxWon": 3020000, "taxByFamilyCount": { "1": 74350, "2": 56850, "3": 31940, "4": 26690, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0, "11": 0 } }
  ]
}
```

**결정 사항과 근거**:

- **`minWon`/`maxWon`은 "원" 단위로 저장한다(원문의 "천원" 그대로 저장하지 않는다).**
  FORMULA.md "단위" 절이 "조회 자체는 원 단위 `taxableMonthlyPay` 그대로 비교"라고 명시했다
  — 조회 대상(`taxableMonthlyPay`)이 항상 정수 원 단위이고 천원 단위로 딱 떨어지지 않을
  수 있으므로(예: 3,013,457원), 비교 자체가 원 단위에서 일어나야 한다. 행 경계를
  천원 단위로 저장하면 조회할 때마다 `× 1000` 변환이 필요해 변환 실수(자릿수 오류) 위험이
  생긴다 — 원 단위로 미리 변환해 저장하면 조회 코드는 `taxableMonthlyPay >= row.minWon &&
  taxableMonthlyPay < row.maxWon` 비교 한 줄로 끝난다. 대신 Builder가 원문(천원 단위)을
  옮길 때 반드시 `× 1,000`을 적용해야 한다는 점을 아래 "파싱 정확성 검증"에 명시한다.
  구간은 원문 그대로 **하한 포함, 상한 미포함**(`이상 ~ 미만`)이다.
- **`taxByFamilyCount`는 배열이 아니라 `"1"~"11"` 키를 가진 객체로 저장한다.** 약
  1,840행을 원문 표에서 옮기는 작업은 사람이 직접 대조해야 하는 고위험 전사(transcription)
  작업이다. 배열 인덱스(`[0]` = 가족 1명)를 쓰면 "인덱스 2가 가족 3명인지 4명인지"를
  매번 암산해야 해 오프바이원 실수가 나기 쉽다. 객체 키(`"3"` = 가족 3명)를 쓰면 원문 표의
  열 라벨("3명")과 JSON 키가 문자 그대로 대응해 시각적 대조가 즉시 가능하다 — 이는 "조회
  성능과 파싱 정확성 검증 용이성을 함께 고려하라"는 요구에서 후자를 우선한 결정이다(조회
  성능 차이는 1,840행 규모에서 배열 인덱스든 객체 키든 무시할 수준).
- **조회 성능**: 이진 탐색(행이 `minWon` 오름차순으로 정렬됨을 전제) 기준 약
  `log2(1840) ≈ 11`회 비교로 끝난다. 선형 탐색을 쓰더라도 클라이언트 계산 1회에 1,840회
  비교는 밀리초 미만이라 실사용에서 성능 문제가 되지 않는다 — 조회 알고리즘 선택 자체는
  이 규모에서 중요하지 않으므로 Builder 재량으로 두되, 정렬 불변식이 깨지지 않도록
  구조 검증 테스트(아래)에 포함한다.
- **파일 크기**: 객체 키 방식이 배열 인덱스 방식보다 약간 더 크지만(행당 약 140~180자,
  전체 약 250~330KB, gzip 후 수십 KB 수준으로 추정), 이 파일은 이 계산기 페이지에서만
  import되므로(Next.js App Router의 라우트 단위 코드 분할) 다른 계산기의 번들에 영향을
  주지 않는다. 파싱 정확성이 더 중요한 이 데이터의 성격상 이 크기 차이는 감수한다.
- **`familyCountColumns`/`range`를 파일 메타데이터에 둔 이유**: `range.maxWon`을
  1억원 초과 여부 판정의 SSOT로 삼는다 — `logic.ts`가 `10_000_000`을 별도로
  하드코딩하지 않고 이 파일의 실제 최대 행 상한을 참조하게 해, "표 범위"와 "1억원 초과
  분기 임계값"이 서로 다른 곳에서 따로 관리되다 어긋나는 것을 막는다(아래 "조회 모듈"
  참고).

### 조회 모듈: `src/calculators/annual-salary-take-home-pay/withholding-table.ts` (Builder 작성)

`business-days/holidays.ts`(원본 JSON을 읽어 조회 전용 함수를 제공하는 계산기 전용
모듈) 패턴을 그대로 따른다. `logic.ts`가 JSON을 직접 import해 순회하지 않고, 이 모듈이
조회 책임을 캡슐화한다.

```ts
// withholding-table.ts (Builder 작성 — 계약만)
export function isWithinWithholdingTableRange(taxableMonthlyPay: number): boolean;
export function lookupWithholdingTaxRow(
  taxableMonthlyPay: number,
): { minWon: number; maxWon: number; taxByFamilyCount: Record<string, number> } | null;
```

### 1억원 초과 산식·11명 초과 산식은 어디에 두는가 — 계산기 전용 `policy.ts` (룩업 테이블과 분리)

이 둘은 **표(룩업)가 아니라 계산식**이므로 대용량 데이터 파일에 두지 않는다. 아래
"3. 정책 데이터 스키마"에서 `policy.ts`로 결정한 이유와 함께 다룬다.

### Builder의 파싱 정확성 검증 방법 (이번 라운드는 스키마만 확정, 데이터는 채우지 않음)

**주의: 이번 Architect 라운드는 실제 1,840행 데이터를 채우지 않는다.** 위 JSON 예시는
스키마를 보여주기 위한 3개 행 예시(FORMULA.md Golden Test 1·5·6에 나오는 값과 정확히
일치하도록 만든 예시)일 뿐, 실제 파일로 생성하지 않았다. Builder는 다음 순서로 검증한다.

1. 국가법령정보센터 원문(FORMULA.md "기준/공식 출처"의 URL, 2026-02-27 개정 별표 2)을
   재열람해 770천원~10,000천원 전 구간을 원 단위(× 1,000)로 변환하며 옮긴다.
2. **구조 불변식 테스트**(`withholding-table.test.ts` 또는 `logic.test.ts`에 추가):
   - 행이 `minWon` 오름차순으로 정렬돼 있고, 인접 행 사이에 틈이나 겹침이 없다
     (`rows[i].maxWon === rows[i+1].minWon`).
   - 첫 행의 `minWon === 770000`, 마지막 행의 `maxWon === 10000000`(FORMULA.md "range"와
     일치).
   - 모든 행이 `"1"`~`"11"` 11개 키를 빠짐없이 갖는다.
   - 모든 세액 값이 0 이상이고 10원의 배수다(FORMULA.md "표에서 조회한 값... 항상 10원
     단위" 진술과 일치 — 어긋나면 전사 오류를 의심할 신호).
3. **Golden Test 값 대조**: FORMULA.md 예제 1・2・3・4・5・6・7・8・9(모두 표 조회 케이스)가
   요구하는 정확한 행(`[3,000,000, 3,020,000)`, `[4,000,000, 4,020,000)` 등)의
   `taxByFamilyCount` 값이 파싱 결과와 정확히 일치하는지 개별 검증한다. 예제 10(1억원
   초과)·11(11명 초과)은 표가 아니라 `policy.ts`의 계산식을 검증하므로 이 단계에서 다시
   확인하지 않는다(아래 "3."에서 다룸). 예제 12는 FORMULA.md 자체가 "확인 필요"로 남긴
   반올림 미확정 사례이므로 Calculation Auditor 단계로 넘긴다.
4. 위 1~3을 모두 통과한 뒤에만 `logic.ts`와 실제로 배선한다.

---

## 3. 정책 데이터 스키마 — `earnedIncomeWithholding`은 계산기 전용 `policy.ts`에 둔다 (`rates-2026.json` 최상위 아님)

FORMULA.md는 `rates-2026.json` 최상위에 `earnedIncomeWithholding` 네임스페이스를 추가하는
초안을 제시했으나(`socialInsurance` 패턴 참고), **housing-subscription-score Architect
라운드가 이미 세운 기준("이 값을 다른 계산기가 재사용할 근거가 실제로 있는가",
`docs/ARCHITECTURE.md` "정책 데이터를 언제 계산기 전용 policy.ts에 두는가")을 그대로
적용해 계산기 전용 `src/calculators/annual-salary-take-home-pay/policy.ts`에 두기로
결정을 바꾼다.**

- **근거**: 자녀세액공제 금액, 11명 초과 산식, 1억원 초과 구간별 계수, 지방소득세율은
  소득세법 시행령 [별표 2]·지방세법이라는 이 계산기에만 등장하는 법령값이다. `four-major-
  insurance`를 포함해 어떤 기존 계산기도 이 값을 쓰지 않고, SPEC "범위 밖"이 종합소득세·
  연말정산 계산기를 명시적으로 제외했으므로 "곧 다른 계산기가 재사용할 것"이라고 볼
  근거도 없다(청약가점 계산기의 배점표와 정확히 같은 상황).
- `rates-2026.json`을 계속 최상위에 확장하면 이 계산기만의 "확인 필요" 각주(고소득 산식
  원 단위 절사, 11명 초과 음수 처리 등)가 `socialInsurance`·`laborStandards` 같은 여러
  계산기 공유 데이터와 섞여 가독성이 떨어진다 — housing-subscription-score와 동일한 이유.
- 메타데이터 필드명(`source`/`lastVerified`/`nextReviewDue`)은 위치와 무관하게
  `rates-{year}.json`과 동일하게 유지한다(`docs/CALCULATOR_RULES.md` 준수, 위치만 다름).
- **`socialInsurance`는 이 결정과 무관하게 그대로 `rates-2026.json` 최상위에 남는다** —
  이미 2개 계산기(`four-major-insurance`, 그리고 이번에 `src/lib/social-insurance.ts`를
  통해 이 계산기)가 공유하므로 재배치하지 않는다.

### `policy.ts` 스키마 초안 (Builder가 작성 — 값은 FORMULA.md에서 그대로 옮김, 이 문서는 형태만 확정)

```ts
// src/calculators/annual-salary-take-home-pay/policy.ts (Builder 작성 예정)
export const EARNED_INCOME_WITHHOLDING_POLICY = {
  effectiveFrom: "2026-03-01",
  source: {
    law: "소득세법 시행령 [별표 2]",
    article: "제189조제1항 관련, 2026. 2. 27. 개정",
    effectiveDate: "2026-03-01",
    url: "https://www.law.go.kr/LSW/flDownload.do?flSeq=164357181&bylClsCd=110201",
  },
  lastVerified: "2026-09-06",
  nextReviewDue: "2027-01-01",
  tableDataRef: "withholding-tax-table-2026.json", // src/data/, 위 "2." 스키마

  childTaxCredit: {
    oneChild: 20830,
    twoChildren: 45830,
    perAdditionalChildOverTwo: 33330,
    floorAtZero: true,
  },

  familyCountOverEleven: {
    // tax(11) - (tax(10) - tax(11)) * (n - 11), n = dependentFamilyCount
    negativeResultHandling: "확인 필요", // FORMULA.md 그대로 옮김 — Architect가 임의로 확정하지 않음
  },

  highIncomeFormula: {
    // 10,000천원(1억원) 시점 세액, 가족 수(1~11)별 고정값. 원 단위.
    baseAmountAtOneHundredMillionWonByFamilyCount: {
      "1": 1507400, "2": 1431570, "3": 1200840, "4": 1170840, "5": 1140840,
      "6": 1110840, "7": 1080840, "8": 1050840, "9": 1020840, "10": 990840, "11": 960840,
    },
    // minWon/maxWon은 원 단위로 통일(위 "2."와 동일 원칙 — 표 파일과 단위 일관성 유지)
    brackets: [
      { minWon: 100_000_000, maxWon: 140_000_000, extraRate: { numerator: 98 * 35, denominator: 100 * 100 }, addWon: 25000 },
      { minWon: 140_000_000, maxWon: 280_000_000, extraRate: { numerator: 98 * 38, denominator: 100 * 100 }, addWon: 1397000 },
      { minWon: 280_000_000, maxWon: 300_000_000, extraRate: { numerator: 98 * 40, denominator: 100 * 100 }, addWon: 6610600 },
      { minWon: 300_000_000, maxWon: 450_000_000, extraRate: { numerator: 40, denominator: 100 }, addWon: 7394600 },
      { minWon: 450_000_000, maxWon: 870_000_000, extraRate: { numerator: 42, denominator: 100 }, addWon: 13394600 },
      { minWon: 870_000_000, maxWon: null, extraRate: { numerator: 45, denominator: 100 }, addWon: 31034600 },
    ],
    roundingUnit: "확인 필요", // Golden Test 12, Calculation Auditor 확정 대기
  },

  localIncomeTaxRate: { numerator: 1, denominator: 10 },
} as const;
```

- **정수 분수(`numerator`/`denominator`)로 요율을 표현한다** — `four-major-insurance`와
  동일 컨벤션(아래 "5. 숫자 정밀도 전략" 참고). `98% × 35%`처럼 원문이 두 백분율의 곱으로
  표기한 경우도 `numerator: 98*35, denominator: 100*100`로 미리 통분해 저장하고, 실제
  곱셈은 로직에서 분자를 먼저 모두 곱한 뒤 마지막에 한 번만 나누게 한다(부동소수점 오차
  방지, `docs/CALCULATOR_RULES.md` "반올림 정책").
- **`brackets`의 `minWon`/`maxWon`도 원 단위로 통일한다** — 위 "2."에서 세액표 파일을
  원 단위로 통일한 것과 같은 이유(단위를 파일마다 다르게 두면 "천원 → 원 변환을 어디서
  하는지" 추적이 어려워진다).
- **"확인 필요" 항목(11명 초과 음수 처리, 고소득 산식 절사 단위)은 값을 추정해 채우지
  않고 그대로 "확인 필요" 문자열로 남긴다** — `docs/CALCULATOR_RULES.md` "확실하지 않은
  수치는 추정하지 않는다" 원칙. Calculation Auditor가 실측 후 이 필드와 FORMULA.md를
  함께 갱신한다.
- Builder는 `logic.ts`에서 `20830`/`98`/`1,507,400` 같은 매직 넘버를 직접 쓰지 않고 이
  객체를 통해서만 읽는다(SPEC "계산 코드에 요율표·세액표를 직접 하드코딩하지 않는다").

---

## 4. 폴더 / 파일 구조

```text
src/calculators/annual-salary-take-home-pay/
  types.ts             입력·결과 타입 (Architect 완성 — 이번 라운드에 작성함)
  policy.ts             자녀세액공제·11명 초과 산식·1억원 초과 산식·지방소득세율 (Builder 작성, 위 "3." 스키마)
  withholding-table.ts  세액표 조회 (Builder 작성, 위 "2." 계약, business-days/holidays.ts 패턴)
  withholding-table.test.ts  구조 불변식 + Golden Test 값 대조 (Builder)
  logic.ts              순수 계산 함수 (Builder, FORMULA.md 계산 순서 그대로,
                        src/lib/social-insurance.ts를 통해 4대 보험 재사용)
  logic.test.ts         Golden Test 12개(FORMULA.md) + 경계값
  validation.ts         입력 검증 (Builder, zod 등)
  validation.test.ts
  formatting.ts         금액·정책 고지 문구 조립
  formatting.test.ts
  content.ts            소개·사용법·FAQ·정책 고지 문구 원본
  ui.tsx                입력·결과·계산 근거·정책 안내 UI
  ui.test.tsx
```

공용 인프라(이번 라운드에 계약만 확정, Builder가 실제로 만듦):

```text
src/lib/social-insurance.ts       four-major-insurance에서 이동한 근로자 부담분 계산 (위 "1.")
src/lib/social-insurance.test.ts  공유 계약 테스트 (선택, 권장)
src/data/withholding-tax-table-2026.json   대용량 세액표 (위 "2.", 이번 라운드는 미생성)
```

`src/data/rates-2026.json`은 이 계산기 때문에 수정하지 않는다(`socialInsurance`는 이미
존재, `earnedIncomeWithholding`은 최상위에 추가하지 않기로 결정함 — 위 "3.").

---

## 5. 숫자 정밀도 전략 — 일반 `Number` + 정수 분수 연산 (four-major-insurance와 동일 전략)

### 결론

**일반 `Number`(배정밀도), 정수 분수(`numerator`/`denominator`) 연산. `BigInt`/`decimal.js`/
`big.js` 전부 쓰지 않는다.** FORMULA.md "단위" 절의 판단을 그대로 확정하되, "최대 금액
규모까지 고려해 안전 정수 범위를 직접 계산해 확인하라"는 요구에 따라 아래에서 이 계산기
고유의 최댓값으로 직접 재계산했다.

### 안전 정수 범위 재계산 (four-major-insurance의 결론을 재사용하지 않고 직접 검증)

- `Number.MAX_SAFE_INTEGER = 2^53 - 1 ≈ 9.007 × 10^15`.
- `annualSalary` 상한 100억 원(`10,000,000,000`) → `monthlyGrossPay = floor(annualSalary /
  12)` 최댓값 ≈ `833,333,333`원. 이는 `four-major-insurance`가 이미 검증한 자체 입력
  상한(월 급여 10억 원)보다 **작다** — 4대 보험 재사용 부분(`src/lib/social-insurance.ts`)은
  four-major-insurance가 이미 검증한 안전 범위 안에 완전히 포함되므로 재검증이 곧
  자동으로 유효하다.
- 이 계산기가 **새로** 도입하는 계산 중 가장 큰 중간값을 직접 확인한다.
  - **국민연금/건강보험**: 상하한 clamp가 먼저 적용되므로(기준소득월액 최대
    6,590,000원, 건강보험 총액 최대 9,183,480원) `monthlyGrossPay`가 아무리 커도 이
    지점 이후 계산은 `annualSalary`와 무관하게 상수로 고정된다. 가장 큰 곱은 장기요양보험
    유도 단계: `employeeHealth(최대 4,591,740, 9,183,480÷2 절사) × 9,448 × 10,000 =
    433,827,595,200,000`(약 4.34 × 10^14) — `MAX_SAFE_INTEGER`(9.007 × 10^15)의 약
    1/20 수준으로 안전하다.
  - **고용보험**: `remuneration(최대 약 833,333,333) × 9 = 7,499,999,997`(약
    7.5 × 10^9) — 문제없음.
  - **근로소득세 1억원 초과 산식**: `초과금액 = (taxableMonthlyPay - 100,000,000)` 최댓값
    ≈ `833,333,333 - 100,000,000 = 733,333,333`. 가장 큰 계수(45%, 통분 시 `× 45 ÷ 100`)를
    적용해도 `733,333,333 × 45 = 32,999,999,985`(약 3.3 × 10^10) — 문제없음. `98% × 35%`
    같은 이중 백분율도 `733,333,333 × 98 × 35 = 2,513,333,331,190`(약 2.5 × 10^12) —
    여전히 `MAX_SAFE_INTEGER`보다 3~4자리 작다.
  - **11명 초과 산식**: `(tax(10) - tax(11)) × (n - 11)` — `n`(dependentFamilyCount)
    상한 30이므로 `(n-11)` 최대 19, 세액표 인접 열 차이는 수만~수십만 원대(표 자체가
    1억원 이하 구간의 실제 세액이므로 상한이 낮음) — 곱해도 수백만 원대에 그친다.
  - **자녀세액공제**: `33,330 × (자녀수 - 2)`, 자녀수 상한은 `dependentFamilyCount - 1`
    (최대 29) — 최대값이 수십만 원대에 불과하다.
  - **지방소득세**: `incomeTax × 1 ÷ 10` — `incomeTax` 자체가 위에서 이미 안전 범위임을
    확인했으므로 안전하다.
- **결론**: 이 계산기가 다루는 가장 큰 중간값(약 4.34 × 10^14, 장기요양보험 유도 단계)도
  `Number.isSafeInteger` 범위 안에 약 20배의 여유를 두고 들어온다. `annualSalary` 상한을
  100억 원으로 올려 잡아도(현재 SPEC 상한) 정수 스케일링·`BigInt`·`decimal.js`가 필요한
  지점이 없다.

### 구현 규칙 (Builder 인수인계)

- 요율·구간 계수는 `%` 리터럴(`× 0.1`, `× 0.35`)로 직접 곱하지 않고 `policy.ts`/
  `rates-2026.json`의 `numerator`/`denominator` 정수 분수로 계산한다(위 "3." `policy.ts`
  스키마가 이미 이 형태로 설계됨).
- 1억원 초과 산식처럼 두 백분율이 곱해지는 경우(`98% × 35%`) 두 분자를 먼저 곱하고
  분모끼리도 먼저 곱한 뒤 마지막에 한 번만 나눈다(중간에 임의 반올림하지 않음 —
  `docs/CALCULATOR_RULES.md` "반올림 정책").
- 4대 보험 부분은 `src/lib/social-insurance.ts`가 이미 확정한 10원 단위 절사 결과를
  그대로 쓰고 다시 반올림하지 않는다.
- 근로소득세(표 조회)는 조회된 정수를 그대로 쓴다. 자녀세액공제 차감은 정수 - 정수라
  반올림 이슈가 없다(음수면 0원으로 `Math.max(x, 0)`).
- 1억원 초과 산식의 최종 원 단위 절사(1원 미만 절사)는 FORMULA.md가 이미 "최종 합산 후
  1원 미만만 절사"를 잠정안으로 남겼으므로 그 잠정안대로 구현하되, Golden Test 12 옆에
  "확인 필요" 주석을 그대로 남긴다 — Architect가 이 잠정안을 확정값으로 바꾸지 않는다.
- 표시는 `Intl.NumberFormat('ko-KR')`로 통일한다.

---

## 6. 타입 결정 (`types.ts` — 이번 라운드에 작성 완료)

`src/calculators/annual-salary-take-home-pay/types.ts`를 이번 라운드에 작성했다. 핵심
결정:

- **`Won` 타입 별칭을 이 계산기 안에서 새로 정의한다**(`four-major-insurance/types.ts`의
  `Won`을 import하지 않음) — `four-major-insurance/types.ts`가 이미 같은 패턴(자체
  `Won` 별칭)을 쓰고 있고, 계산기 폴더 간 타입 import는 "다른 계산기에 영향 없이 이 폴더
  하나만 수정할 수 있어야 한다"는 원칙에 어긋나는 불필요한 결합이다. 진짜 공유가 필요한
  것은 `src/lib/social-insurance.ts`의 함수/타입뿐이다.
- **`incomeTaxSource: "table" | "highIncomeFormula"`, `familyCountSource: "table" |
  "over11Formula"`** 두 유니온 필드를 결과에 추가했다. FORMULA.md "출력값" 표에는 없지만,
  SPEC Must Have("결과에 영향을 준 정책 규칙을 사용자가 이해할 수 있는 말로 설명")를
  충족하려면 UI가 "이 결과는 표 조회가 아니라 산식으로 계산됐다"는 사실을 재판정 없이 알
  수 있어야 한다 — `four-major-insurance`의 `pensionMinimumApplied` 같은 "이미 계산된
  플래그를 그대로 노출" 패턴과 동일하다.
- **`childTaxCreditFloorApplied: boolean`, `isBelowTaxableThreshold: boolean`** 도 같은
  이유로 추가했다 — FORMULA.md "예외" 절이 요구하는 두 고지("공제 결과 음수라 0원으로
  조정", "간이세액표 최저구간 이하로 세액 없음")를 UI가 문자열 비교 없이 판정할 수 있게
  한다.
- **4대 보험 상하한 플래그(`pensionMinimumApplied` 등)는 `src/lib/
  social-insurance.ts`의 `EmployeeSocialInsuranceCoreResult`와 이름을 그대로 맞춘다** —
  같은 개념에 다른 이름을 쓰면 두 계산기의 UI 문구·문서를 대조할 때 혼란을 준다.
- **`appliedRateYear`/`appliedSocialInsurancePeriod`/`appliedWithholdingTableEffectiveFrom`
  을 분리한 이름으로 둔다**(`appliedRatePeriod` 하나로 합치지 않음) — FORMULA.md "상태"
  절이 4대 보험(2026-07-01 이후)과 간이세액표(2026-03-01 이후)의 시행일이 **서로 다름**을
  명시했다. 하나의 필드로 합치면 두 정책 중 어느 것의 시행일인지 UI 문구에서 다시 판단해야
  하는 모호함이 생긴다.
- **입력 타입에는 `dependentFamilyCount`/`childrenAge8to20Count`만 두고, "가족 수 11
  초과 여부" 같은 파생 판정은 넣지 않는다** — `housing-subscription-score`의 "조건부
  파생 값은 입력이 아니라 결과에만 둔다" 컨벤션과 동일.

```ts
// src/calculators/annual-salary-take-home-pay/types.ts (실제 작성함, 아래 "산출물" 참고)
```

전체 내용은 실제 파일(`src/calculators/annual-salary-take-home-pay/types.ts`) 참고.

---

## 7. UI 구조

`docs/DESIGN_SYSTEM.md` "공통 화면 순서"(소개 → 사용 방법 → 입력 → 결과 → 계산 근거 →
정책 안내 → FAQ)를 그대로 따르고, 기존 4개 공용 컴포넌트(`SectionCard`, `UsageGuide`,
`IntroSection`, `FaqAccordion`)를 재사용한다. 새 Generic 컴포넌트는 만들지 않는다.

### 입력 순서 (SPEC "핵심 사용자 흐름" 그대로)

1. **세전 연봉**(`annualSalary`, 필수) — helpText: "상여·수당을 모두 포함한 세전 연봉을
   입력하세요. 이 계산기는 '연봉 ÷ 12'로 월급을 환산합니다(방식 A)."
2. **월 비과세 금액**(`monthlyNonTaxablePay`, 선택, 기본 0) — helpText: "식대 등 4대
   보험·세금에서 제외되는 금액(월 기준)."
3. **부양가족 수(본인 포함)**(`dependentFamilyCount`, 필수, 기본 1) — helpText: "배우자도
   1명으로 계산합니다. 정확한 연말정산 신고 내용과 다르면 결과가 달라질 수 있습니다."
4. **8세~20세 자녀 수**(`childrenAge8to20Count`, 선택, 기본 0), `dependentFamilyCount -
   1`을 넘을 수 없다는 제약을 인라인으로 안내.

금액 입력은 타이핑 중 천 단위 콤마(`severance-pay`의 `handleAmountChange` 패턴),
`inputMode="numeric"`.

### 결과 화면

1. **핵심 결과 카드**(`bg-primary`): `netMonthlyPay`(세후 월 실수령액)만 크게. 바로 아래
   "세전 월급여 {monthlyGrossPay}원 중 공제 {totalDeductions}원"을 한 줄 요약으로.
2. **공제 내역 카드**(그리드 또는 표, 모바일은 카드로 접힘): 4대 보험(국민연금/건강보험/
   장기요양보험/고용보험 개별 + 합계), 근로소득세, 지방소득세, 공제 합계 — SPEC "계산
   결과" 항목 순서 그대로.
3. **경고/고지 카드**(조건부, `bg-warning-surface`): `pensionMinimumApplied` 등 4대 보험
   상하한 적용, `incomeTaxSource === "highIncomeFormula"`(1억원 초과 산식 고지),
   `familyCountSource === "over11Formula"`(11명 초과 산식 고지), `isBelowTaxableThreshold`
   (간이세액표 최저구간 이하), `childTaxCreditFloorApplied` — `weekly-holiday-allowance`
   패턴대로 해당 항목 근처에 개별적으로 표시(한곳에 뭉치지 않음).
4. **계산 근거(`SectionCard`, "계산 방법")**: FORMULA.md "계산 순서" 1~9단계를 실제
   대입값과 함께 표시.
5. **정책 안내(`SectionCard` 또는 `bg-surface-subtle`)**: 다음을 모두 표시(SPEC Must
   Have "설명과 정책 고지" 항목과 1:1 대응, 조건부로 숨기지 않고 항상 노출):
   - 기준연도·기준일 배지 **두 개** 분리 표시(4대 보험 2026-07-01, 간이세액표
     2026-03-01) — 위 "6." 타입 결정에서 필드를 분리한 이유와 동일.
   - "연말정산 미반영, 매월 원천징수 기준" 고지.
   - "회사 급여 시스템·4대보험 신고 보수월액·비과세 구성에 따라 실제 금액이 달라질 수
     있음" 고지.
   - "국세청·공단의 공식 고지액이 아닌 모의계산" 고지.
   - "입력값은 브라우저에서만 계산, 서버 전송·저장 없음" 고지.
6. **FAQ**: `FaqAccordion`(Should Have, 시간이 되면).

### 접근성/반응형

SPEC 공통 요건 그대로 — 결과 영역 `aria-live="polite"`, 모든 입력 `label` 연결,
320~1440px 무중단.

---

## 8. 계산기 등록 전략

- 이번 Architect 단계에서는 등록하지 않는다(빈 URL 노출 방지, 기존 관례).
- Builder가 UI 구현을 완료하면 `registry.ts`에 다음으로 등록한다:
  ```
  slug: "annual-salary-take-home-pay"
  title: "연봉 실수령액 계산기"
  category: "tax"
  status: "draft"
  ```
  - **아이콘**: 기존 6개 키(`coins`/`calculator`/`calendar`/`chart`/`heart`/`utility`) 중
    `coins`를 제안한다 — `severance-pay`(퇴직금)·`military-salary`(군인 월급)가 이미
    "금액/급여" 계열에 `coins`를 쓰고 있어 "월급·실수령액"이라는 결과 성격과 가장 잘
    맞는다. `four-major-insurance`가 이미 `tax` 카테고리에서 `heart`를 쓰고 있어 같은
    카테고리 안에서도 시각적으로 구분된다(`housing-subscription-score`=chart,
    `four-major-insurance`=heart, 이번=coins로 `tax` 카테고리 내 3종 아이콘이 모두
    달라짐).
- Calculation Auditor + UX/UI Critic + QA 통과 전에는 `published`로 바꾸지 않는다.

---

## 9. Builder 인수인계 요약

1. **`src/lib/social-insurance.ts` 먼저 만든다** — `four-major-insurance/logic.ts`의
   근로자 부담분 계산을 위 "1." 계약대로 그대로 이동(재작성 금지). 이동 직후
   `four-major-insurance/logic.test.ts` 전체 재실행 + `npx tsc --noEmit`으로 회귀 없음을
   확인한 뒤에만 다음 단계로 진행한다.
2. **`src/data/withholding-tax-table-2026.json`** — 위 "2." 스키마대로 국가법령정보센터
   원문을 재대조하며 1,840행을 채운다(원 단위 변환 주의). 구조 불변식 테스트 +
   Golden Test 9개(표 조회 케이스) 대조를 통과한 뒤에만 `logic.ts`와 배선한다.
3. **`policy.ts`** — 위 "3." 스키마 그대로. 값은 FORMULA.md "3-2"~"3-4", "정책 데이터
   파일 스키마 초안"에서 그대로 옮긴다(새 값 추정 금지, "확인 필요"는 그대로 유지).
4. **`withholding-table.ts`** — 위 "2." 계약대로 이진 탐색 조회 함수 구현.
5. **`logic.ts`** — FORMULA.md "계산 순서" 1~9단계를 그대로 구현. 4대 보험은
   `src/lib/social-insurance.ts`, 세액 조회는 `withholding-table.ts`, 계수는 `policy.ts`
   만 참조하고 매직 넘버를 쓰지 않는다.
6. **`logic.test.ts`** — FORMULA.md 검증 예제 12개를 그대로 Golden Test로(예제 12는
   "확인 필요" 상태를 테스트에도 명시적으로 남긴다 — 값이 바뀔 수 있음을 주석으로 표시).
7. **`validation.ts`** — FORMULA.md "입력값" 표의 허용 범위, "예외" 절의 조건(비과세 >
   월급여, 자녀수 > 가족수-1 등)을 검증.
8. **`formatting.ts`, `content.ts`, `ui.tsx`** — 위 "7." 화면 구조대로.
9. 레지스트리에 `status: "draft"`로 등록.
10. **새 계산기 완료 후 기존 계산기 Smoke Test**(`docs/EVALUATION.md` "회귀 방지") — 특히
    `four-major-insurance`를 리팩터링했으므로 그 계산기의 UI(`ui.tsx`)가 여전히 기존
    동작대로 렌더링되는지, `logic.test.ts`/`ui.test.tsx`가 모두 통과하는지 반드시
    재확인한다.

---

## 문서 갱신

`docs/ARCHITECTURE.md`에 "결정 사례: 계산 로직 공용화를 날짜 산술 밖으로 확장 —
`src/lib/social-insurance.ts`" 결정 사례를 추가했다(위 "1." 참고).

## 남은 리스크 / 확인 필요

- FORMULA.md가 "확인 필요"로 남긴 5개 항목(1억원 초과 산식 절사 단위, 11명 초과 음수
  처리, 자녀 나이 판정 시점, data.go.kr 2026년판 데이터셋 ID, 홈택스 실측 대조)은 Architect
  영역 밖이다. Calculation Auditor 단계에서 재확인을 권고한다(FORMULA.md가 이미 명시).
- `four-major-insurance/logic.ts` 리팩터링은 이번 라운드에서 실행하지 않고 계약만
  확정했다 — Builder가 실제로 이동 작업을 수행하고 회귀 테스트를 실행해야 한다(위 "1.",
  "9." 1번).
- 대용량 세액표(1,840행) 전사는 이 계산기 전체 작업에서 가장 오류 위험이 큰 단계다 —
  구조 불변식 테스트를 반드시 Golden Test보다 먼저 통과시켜야 한다(위 "2." 검증 순서).
