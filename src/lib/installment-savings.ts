/**
 * 정기적립식(매월 동일 금액, 정상 납입) 상품의 단리 후취식 총 이자 — 도메인 의미 없는 순수 산술.
 *
 * ```
 * interest_i = contribution × (annualRatePercent/100) × remainingMonths_i ÷ 12
 * remainingMonths_i = months - i + 1     (i = 1..months, 1-indexed 회차)
 * 총합 = Σ_{i=1}^{months} interest_i
 *      = contribution × (annualRatePercent/100) × [months×(months+1)/2] ÷ 12   (닫힌 형, 등차수열 합)
 * ```
 * 1회차(첫 납입)가 만기까지 가장 오래 남아 있어 이자가 가장 크고, 마지막 회차는 1개월분
 * 이자만 받는다("월초 납입, 매월 초 반복, 만기일에 원리금 전체 지급"이라는 표준 적금 구조).
 *
 * **공용화 배경**: `src/calculators/military-salary/logic.ts`(장병내일준비적금)와
 * `src/calculators/deposit-savings-interest-calculator/logic.ts`(일반 시중 적금)가 완전히
 * 동일한 수식·동일한 반올림 정책(원 단위 미만 절사)을 쓴다는 것을 확인하고 이 파일로
 * 추출했다 — 두 계산기의 법적 근거(정책 상품 vs 일반 상품)는 다르지만, 이 산식 자체는
 * 어느 쪽 FORMULA.md도 법령이 아니라 "사용자가 입력한 금리로 추정하는 표준 재무수학"으로
 * 문서화한다(법적 정의가 달라도 산식이 완전히 동일하면 `docs/ARCHITECTURE.md` "계산 로직
 * 공용화"가 확립한 일반 기준을 적용해 공유한다 — `tasks/minimum-wage-calculator/
 * ARCHITECTURE.md` "1.2"가 재확인한 것과 같은 판단). 상세 결정 근거는
 * `tasks/deposit-savings-interest-calculator/ARCHITECTURE.md` "3. 적금 단리 후취식 산식의
 * 코드 위치"를 참고한다.
 *
 * 이 파일은 어떤 금융상품인지(정책 적금인지 일반 적금인지, 회차별 표시가 필요한지)를 전혀
 * 알지 못하는 최소 단위 산술만 담는다 — `src/lib/date-calc.ts`/`src/lib/social-insurance.ts`가
 * 지켜온 "도메인 의미 없는 순수 산술만 둔다"는 경계와 동일하다. 회차별 breakdown(각 회차의
 * 잔여개월·이자를 독립적으로 반올림해 표 형태로 보여주는 로직)은 이 산식을 필요로 하는
 * 계산기가 하나뿐이라(v1 기준) 각 계산기 전용 코드에 남긴다 — military-salary는 회차별
 * breakdown 자체가 없고, deposit-savings-interest-calculator만 필요로 한다.
 */

/**
 * **부동소수점(IEEE 754 double) 오차 없이 BigInt 기반 정확한 유리수 연산으로 계산한다.**
 *
 * **왜 부동소수점 대신 BigInt 유리수 연산인가**: 이 함수는 원래 `Math.floor(contribution ×
 * (annualRatePercent/100) × [months×(months+1)/2] / 12)`로 구현되어 있었다. 이 산식은
 * 지수 연산이 없어 "구조적으로 안전할 것"이라는 이론적 추정이 있었으나, Calculation Auditor
 * 재검증이 브루트포스(원금·연이율·기간 전체 격자 대조)로 이 추정이 틀렸음을 실증했다 —
 * epsilon 보정 자체가 전혀 없었기 때문에 부동소수점 표현 오차만으로도 **전체 입력 도메인의
 * 5~10%**에서 진짜 정수 정답을 1원 작게 절사했다(예: `monthlyContributionWon=10,000,
 * annualRatePercent=0.03, months=7` → 옛 구현 `6`, 정답 `7`. `tasks/deposit-savings-
 * interest-calculator/EVALUATION.md` "## Calculation Auditor (재검증)" "3-B" 절). 이
 * 함수는 이미 배포된 `src/calculators/military-salary/logic.ts`도 그대로 공유해서 쓰므로
 * (예: `monthlyContributionWon=550,000, annualRatePercent=4.02, months=3` → 옛 구현
 * `11,054`, 정답 `11,055`), 실사용자에게 실제로 영향을 준 결함이었다.
 *
 * **유도**: `annualRatePercent`는 소수 둘째 자리까지이므로 `annualRatePercent × 100`은
 * 항상 정수다(`rateHundredths`). `annualRatePercent/100 = rateHundredths/10000`이므로
 * ```
 * 총합 = contribution × (rateHundredths/10000) × [months×(months+1)/2] / 12
 *      = contribution × rateHundredths × [months×(months+1)/2] / 120000
 * ```
 * `months×(months+1)`은 연속한 두 정수의 곱이라 항상 짝수이므로 `/2`도 BigInt 정수
 * 나눗셈에서 나머지 없이 정확하다. 분자·분모 모두 0 이상의 정수이므로(연이율·납입액·기간
 * 모두 0 이상), BigInt 나눗셈(0 방향 절삭)이 그대로 `Math.floor`와 같은 결과를 낸다 —
 * 근사가 아니라 수학적으로 엄밀한 값이므로 epsilon 자체가 필요 없다.
 *
 * **함수 시그니처와 반환값의 의미(원 단위 미만 절사된 정수)는 이번 수정으로 바뀌지 않는다**
 * — `military-salary`가 이 함수를 그대로 호출하므로, 시그니처를 바꾸면 호출부가 깨진다.
 *
 * @param monthlyContributionWon 회차별 납입액(원, 매월 동일 금액 가정).
 * @param annualRatePercent 연이율(%, `3`처럼 입력 — 내부에서 `/100`으로 변환한다).
 * @param months 총 납입 회차 수(개월). 정수를 전제한다(호출부가 검증한다).
 * @returns 원 단위 미만 절사된 총 세전 이자(정수, 원).
 */
export function calculateInstallmentSimpleInterestTotal(
  monthlyContributionWon: number,
  annualRatePercent: number,
  months: number,
): number {
  const rateHundredths = BigInt(Math.round(annualRatePercent * 100));
  const n = BigInt(months);
  const sumOfRemainingMonths = (n * (n + 1n)) / 2n; // n(n+1)/2, 연속 정수 곱은 항상 짝수라 나머지 없음
  const denominator = 120000n; // 100(퍼센트 환산) × 100(rateHundredths 환산) × 12(개월)

  const numerator = BigInt(monthlyContributionWon) * rateHundredths * sumOfRemainingMonths;

  return Number(numerator / denominator);
}
