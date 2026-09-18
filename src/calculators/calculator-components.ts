import type { ComponentType } from "react";
import SeverancePayCalculatorUi from "./severance-pay/ui";
import UnemploymentBenefitCalculatorUi from "./unemployment-benefit/ui";
import WeeklyHolidayAllowanceCalculatorUi from "./weekly-holiday-allowance/ui";
import FourMajorInsuranceUi from "./four-major-insurance/ui";
import MilitaryDischargeDateUi from "./military-discharge-date/ui";
import BusinessDaysUi from "./business-days/ui";
import ParentalLeaveBenefitUi from "./parental-leave-benefit/ui";
import AgeCalculatorUi from "./age-calculator/ui";
import BmiCalculatorUi from "./bmi-calculator/ui";
import MilitarySalaryUi from "./military-salary/ui";
import HousingSubscriptionScoreUi from "./housing-subscription-score/ui";
import AnnualSalaryTakeHomePayUi from "./annual-salary-take-home-pay/ui";
import LoanInterestCalculatorUi from "./loan-interest-calculator/ui";
import BillSplitCalculatorUi from "./bill-split-calculator/ui";
import AverageCostCalculatorUi from "./average-cost-calculator/ui";
import DdayCalculatorUi from "./d-day-calculator/ui";
import NationalPensionBenefitEstimateUi from "./national-pension-benefit-estimate/ui";
import BmrCalculatorUi from "./bmr-calculator/ui";
import HousingAcquisitionTaxUi from "./housing-acquisition-tax/ui";
import AnnualLeaveAllowanceUi from "./annual-leave-allowance/ui";
import MinimumWageCalculatorUi from "./minimum-wage-calculator/ui";
import DepositSavingsInterestCalculatorUi from "./deposit-savings-interest-calculator/ui";
import RealEstateBrokerageFeeCalculatorUi from "./real-estate-brokerage-fee-calculator/ui";

/**
 * 계산기 slug와 실제 화면 구현의 연결점. 메타데이터 레지스트리와 분리해 서버용 데이터가
 * 클라이언트 컴포넌트에 의존하지 않게 유지한다.
 *
 * unemployment-benefit은 registry.ts의 status가 여전히 "draft"라 sitemap/robots/홈/카테고리
 * 목록에는 노출되지 않지만(getPublishedCalculators() 필터), 여기 등록해 두면 URL을 직접 알고
 * 접근했을 때 페이지 자체는 렌더링된다 — app/calculators/[slug]/page.tsx의 주석 참고
 * (registry.ts의 status를 published로 바꾸는 것은 Calculation Auditor/QA 통과 이후의 절차이며
 * Builder 권한 밖이다).
 */
export const calculatorComponents: Record<string, ComponentType> = {
  "severance-pay": SeverancePayCalculatorUi,
  "unemployment-benefit": UnemploymentBenefitCalculatorUi,
  "weekly-holiday-allowance": WeeklyHolidayAllowanceCalculatorUi,
  "four-major-insurance": FourMajorInsuranceUi,
  "military-discharge-date": MilitaryDischargeDateUi,
  "business-days": BusinessDaysUi,
  "parental-leave-benefit": ParentalLeaveBenefitUi,
  "age-calculator": AgeCalculatorUi,
  "bmi-calculator": BmiCalculatorUi,
  "military-salary": MilitarySalaryUi,
  "housing-subscription-score": HousingSubscriptionScoreUi,
  "annual-salary-take-home-pay": AnnualSalaryTakeHomePayUi,
  "loan-interest-calculator": LoanInterestCalculatorUi,
  "bill-split-calculator": BillSplitCalculatorUi,
  "average-cost-calculator": AverageCostCalculatorUi,
  "d-day-calculator": DdayCalculatorUi,
  "national-pension-benefit-estimate": NationalPensionBenefitEstimateUi,
  "bmr-calculator": BmrCalculatorUi,
  "housing-acquisition-tax": HousingAcquisitionTaxUi,
  "annual-leave-allowance": AnnualLeaveAllowanceUi,
  "minimum-wage-calculator": MinimumWageCalculatorUi,
  "deposit-savings-interest-calculator": DepositSavingsInterestCalculatorUi,
  "real-estate-brokerage-fee-calculator": RealEstateBrokerageFeeCalculatorUi,
};

export function hasCalculatorComponent(slug: string): boolean {
  return slug in calculatorComponents;
}
