/**
 * 대출 이자 계산기 — 공개 진입점.
 *
 * `repaymentMethod`로 세 상환방식 전용 모듈 중 하나를 호출한다. 공식 자체는 이 파일에 없다
 * (각 모듈이 담당) — 여기서는 분기만 한다. `RepaymentMethod`가 세 값으로 고정된 union이라
 * switch문이 TypeScript exhaustiveness 체크의 도움을 받는다(ARCHITECTURE.md "7." 참고 —
 * 방식 추가/삭제 시 컴파일 타임에 누락을 잡는다).
 */

import type { LoanInterestCalculatorInput, LoanInterestCalculatorResult } from "../types";
import { calculateBulletLoan } from "./bullet";
import { calculateEqualInstallmentLoan } from "./equal-installment";
import { calculateEqualPrincipalLoan } from "./equal-principal";

export function calculateLoanInterest(
  input: LoanInterestCalculatorInput,
): LoanInterestCalculatorResult {
  switch (input.repaymentMethod) {
    case "equalInstallment":
      return calculateEqualInstallmentLoan(input);
    case "equalPrincipal":
      return calculateEqualPrincipalLoan(input);
    case "bullet":
      return calculateBulletLoan(input);
    default: {
      const exhaustiveCheck: never = input.repaymentMethod;
      throw new Error(`알 수 없는 상환방식입니다: ${exhaustiveCheck}`);
    }
  }
}
