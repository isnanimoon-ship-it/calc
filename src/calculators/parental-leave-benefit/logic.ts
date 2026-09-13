import { addCalendarMonthsClamped, endOfCompleteMonths, isOnOrBefore18MonthBirthday } from "./date-utils";
import { getGeneralPolicy, getParentsTogetherPolicy, singleParentPolicy, type BenefitPolicy } from "./policy";
import type { BenefitMonth, ParentalLeaveBenefitInput, ParentalLeaveBenefitResult } from "./types";

function applyPolicy(ordinaryWageWon: number, policy: BenefitPolicy) {
  const baseWon = Math.floor(ordinaryWageWon * policy.ratePercent / 100);
  return { baseWon, benefitWon: Math.min(policy.capWon, Math.max(policy.floorWon, baseWon)) };
}

function getPolicy(input: ParentalLeaveBenefitInput, benefitMonth: number, specialMonths: number): BenefitPolicy {
  if (input.scheme === "parents-together" && benefitMonth <= specialMonths) return getParentsTogetherPolicy(benefitMonth);
  if (input.scheme === "single-parent" && benefitMonth <= 3) return singleParentPolicy;
  return getGeneralPolicy(benefitMonth);
}

export function calculateParentalLeaveBenefit(input: ParentalLeaveBenefitInput): ParentalLeaveBenefitResult {
  const currentEligible = input.scheme === "parents-together" && input.childBirthDate
    ? isOnOrBefore18MonthBirthday(input.childBirthDate, input.startDate) : false;
  const spouseEligible = input.scheme === "parents-together" && input.childBirthDate && input.spouseStartDate
    ? isOnOrBefore18MonthBirthday(input.childBirthDate, input.spouseStartDate) : false;
  const availableSpecialMonths = currentEligible && spouseEligible ? Math.min(input.spouseLeaveMonths ?? 0, 6) : 0;
  const specialLimit = Math.max(0, Math.min(6, availableSpecialMonths));
  const conditional = input.scheme === "parents-together" && input.spouseLeaveStatus === "planned";
  const months: BenefitMonth[] = [];

  for (let index = 0; index < input.leaveMonths; index += 1) {
    const benefitMonth = input.priorLeaveMonths + index + 1;
    const policy = getPolicy(input, benefitMonth, specialLimit);
    const amounts = applyPolicy(input.ordinaryWageWon, policy);
    const startDate = addCalendarMonthsClamped(input.startDate, index);
    months.push({
      benefitMonth, currentLeaveMonth: index + 1, startDate,
      endDate: endOfCompleteMonths(input.startDate, index + 1),
      policyId: policy.id, policyLabel: policy.label, ratePercent: policy.ratePercent,
      capWon: policy.capWon, floorWon: policy.floorWon, ...amounts,
      isConditional: conditional && policy.id === "parents-together",
    });
  }

  const notices: string[] = [];
  if (input.scheme === "parents-together" && (!currentEligible || !spouseEligible)) notices.push("부모 중 한 명의 육아휴직 개시일이 자녀 생후 18개월 범위를 지나 부모 함께 특례 대신 일반 기준을 적용했습니다.");
  if (conditional) notices.push("배우자의 예정된 육아휴직을 전제로 한 조건부 예상액입니다.");
  if (input.scheme === "parents-together" && input.spouseLeaveStatus === "used") notices.push("두 번째 부모가 급여를 신청할 때 첫 번째 부모에게 일반급여와 특례급여의 차액이 추가 지급될 수 있습니다.");
  if (input.priorLeaveMonths > 0) notices.push(`동일 자녀의 선행 육아휴직 ${input.priorLeaveMonths}개월 다음 급여월부터 계산했습니다.`);

  const totalBenefitWon = months.reduce((sum, month) => sum + month.benefitWon, 0);
  const specialMonths = months.filter((month) => month.policyId === "parents-together" || month.policyId === "single-parent-1-3").length;
  const specialSubtotalWon = months.filter((month) => month.policyId === "parents-together" || month.policyId === "single-parent-1-3").reduce((sum, month) => sum + month.benefitWon, 0);
  return {
    startDate: input.startDate, endDate: endOfCompleteMonths(input.startDate, input.leaveMonths),
    leaveMonths: input.leaveMonths, priorLeaveMonths: input.priorLeaveMonths,
    totalAccumulatedMonths: input.priorLeaveMonths + input.leaveMonths,
    ordinaryWageWon: input.ordinaryWageWon, scheme: input.scheme, specialMonths,
    months, totalBenefitWon, averageBenefitWon: Math.floor(totalBenefitWon / input.leaveMonths),
    generalSubtotalWon: totalBenefitWon - specialSubtotalWon, specialSubtotalWon, conditional, notices,
  };
}
