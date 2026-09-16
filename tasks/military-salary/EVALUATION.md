# EVALUATION: 군인 월급 계산기

평가일: 구현 후 작성

## Calculation Auditor

- 2026년 공무원보수규정 별표 13 대조
- 복무형태별 표준 복무개월과 계급개월 합 검산
- 장병내일준비적금 납입한도·매칭지원금 대조
- 은행이자 추정식과 원 단위 처리 검토
- 공식 자료로 확정되지 않은 월중 일할 봉급이 결과에 혼입되지 않았는지 확인

판정: `TODO`

## UX/UI Critic

- 봉급과 적금 만기자산을 혼동하지 않는가
- 복무형태와 적금 입력의 조건부 노출이 자연스러운가
- 핵심 결과에서 총액의 구성과 시점을 바로 알 수 있는가
- 모바일·다크모드에서 계급표와 금액 위계가 유지되는가

판정: `TODO`

## 최종 공개 조건

- 총점 92점 이상
- 계산 정확성 33/35 이상
- Critical·High 결함 0건
- QA 완료 후에만 `published` 전환

## 부록: 공유 함수(installment-savings.ts)의 부동소수점 버그 발견·수정 기록 (2026-09-15)

이 계산기 자체의 SPEC.md/FORMULA.md(산식·정책)는 바뀌지 않았다. 아래는 이 계산기가 그대로
가져다 쓰는 **공유 함수**에서 발견·수정된, 이미 배포된 코드의 실제 결함을 기록하는 부록이다
(작업 출처: `tasks/deposit-savings-interest-calculator/` 작업 중 진행된 Calculation
Auditor 재검증·Optimizer 2차 라운드).

- **발견 경위**: "예금·적금 이자 계산기" 신규 작업의 Calculation Auditor 재검증이,
  `src/calculators/military-salary/logic.ts`가 `src/lib/installment-savings.ts`의
  `calculateInstallmentSimpleInterestTotal`을 그대로 import해서 쓰고 있음을 확인하고, 이
  함수를 브루트포스(원 단위 이자 계산 전체 입력 도메인 대조)로 검증한 결과 epsilon 보정이
  전혀 없는 순수 `Math.floor`라 부동소수점 표현 오차만으로 **전체 입력 도메인의 5~10%**에서
  진짜 정수 정답을 1원 작게 계산하는 것을 실증했다(`tasks/deposit-savings-interest-
  calculator/EVALUATION.md` "## Calculation Auditor (재검증)" "3-B" 절).
- **military-salary 실사용 범위에서 실제로 발생한 반례**: `monthlyContributionWon=550,000,
  expectedAnnualRatePercent=4.02, contributionMonths=3` → 수정 전 `estimatedInterestWon=
  11,054`(오답), 정답 `11,055`. 이는 이번 라운드에서 새로 생긴 결함이 아니라, 원래 이
  계산기에 인라인으로 있던 코드(`Math.floor(monthlyContributionWon×(rate/100)×
  (n×(n+1)/2)/12)`)가 `src/lib/installment-savings.ts`로 추출되기 전부터 갖고 있던
  잠재적 결함이며, 이번에 최초로 발견되었다.
- **수정**: `calculateInstallmentSimpleInterestTotal`을 BigInt 기반 정확한 유리수 연산으로
  재구현했다(`annualRatePercent`를 정수 `rateHundredths`로 변환해 `contribution ×
  rateHundredths × [months×(months+1)/2] / 120000`을 BigInt 나눗셈으로 계산 — 근사가
  아니라 수학적으로 엄밀한 값). 함수 시그니처와 반환값의 의미(원 단위 미만 절사된 정수)는
  전혀 바뀌지 않았으므로 이 계산기의 호출부(`src/calculators/military-salary/logic.ts`)는
  수정이 필요 없었다.
- **이 계산기에 미치는 영향**: 기존 Golden Test(`logic.test.ts`의 "원금·이자·100% 매칭을
  분리한다", `monthlyContributionWon=550,000, contributionMonths=18,
  expectedAnnualRatePercent=5` → `estimatedInterestWon=391,875`)는 나머지 없이 정확히
  나누어떨어지는 값이라(`550,000×0.05×171/12=391,875`, 정수) 원래부터 버그의 영향을 받지
  않았다 — **이 값은 바뀌지 않는다**(수정 전후 동일). 새로 회귀 테스트 1건을 추가했다:
  `monthlyContributionWon=550,000, expectedAnnualRatePercent=4.02, contributionMonths=3`
  → `estimatedInterestWon=11,055`(수정 전 오답 `11,054`이 아님을 고정).
- **검증**: 독립 브루트포스(Python `fractions.Fraction`, military-salary 실사용 범위 —
  월 납입액 최대 550,000원, 연이율 0~10%, 개월 1~24 포함해 총 5.6만여 건)로 불일치 0건을
  확인했다. 상세는 `tasks/deposit-savings-interest-calculator/EVALUATION.md`
  "## Optimizer (2차)" 절과 `src/lib/installment-savings.test.ts` 참고.
- **참고**: 이 계산기는 `src/calculators/registry.ts`상 이미 `status: "published"`
  (2026-09-06)이지만, 이 파일(`tasks/military-salary/EVALUATION.md`) 본문의 Calculation
  Auditor/UX/UI Critic 판정란은 여전히 `TODO`로 남아 있다(역할 기반 개발 체계 도입 이전에
  작성된 초기 계산기라 이 파일 자체가 사후적으로 채워지지 않은 것으로 보인다 — 이 부록이
  다루는 범위 밖의 별개 이슈). 이 부록은 그 상태와 무관하게 "이미 배포된 코드에 있던
  부동소수점 버그가 공유 함수 수정으로 실제로 해소되었다"는 사실만 기록한다.
