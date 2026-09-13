import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it } from "vitest";
import SeverancePayCalculatorUi from "@/src/calculators/severance-pay/ui";
import UnemploymentBenefitCalculatorUi from "@/src/calculators/unemployment-benefit/ui";
import WeeklyHolidayAllowanceCalculatorUi from "@/src/calculators/weekly-holiday-allowance/ui";
import FourMajorInsuranceUi from "@/src/calculators/four-major-insurance/ui";
import MilitaryDischargeDateUi from "@/src/calculators/military-discharge-date/ui";
import BusinessDaysUi from "@/src/calculators/business-days/ui";
import ParentalLeaveBenefitUi from "@/src/calculators/parental-leave-benefit/ui";

const cases: Array<{ name: string; Component: ComponentType; sample: string; calculate: string }> = [
  { name: "퇴직금", Component: SeverancePayCalculatorUi, sample: "샘플 값 채우기", calculate: "퇴직금 계산하기" },
  { name: "실업급여", Component: UnemploymentBenefitCalculatorUi, sample: "샘플 값 채우기", calculate: "구직급여 계산하기" },
  { name: "주휴수당", Component: WeeklyHolidayAllowanceCalculatorUi, sample: "샘플 값 채우기", calculate: "주휴수당 계산하기" },
  { name: "4대 보험", Component: FourMajorInsuranceUi, sample: "샘플 값", calculate: "보험료 계산하기" },
  { name: "전역일", Component: MilitaryDischargeDateUi, sample: "오늘 입영 샘플", calculate: "전역일 계산하기" },
  { name: "영업일", Component: BusinessDaysUi, sample: "샘플 값", calculate: "영업일 계산하기" },
  { name: "육아휴직급여", Component: ParentalLeaveBenefitUi, sample: "예시 입력", calculate: "예상 급여 계산하기" },
];

function resultUrlFromXLink(region: HTMLElement): string | null {
  const link = region.querySelector<HTMLAnchorElement>('a[aria-label="X로 공유"]');
  if (!link) return null;
  return new URL(link.href).searchParams.get("url");
}

describe("계산기 결과 공유 복원", () => {
  afterEach(() => window.history.replaceState({}, "", "/"));

  for (const item of cases) {
    it(`${item.name} 결과를 s 파라미터로 공유하고 다시 복원한다`, async () => {
      const first = render(<item.Component />);
      fireEvent.click(screen.getByRole("button", { name: item.sample }));
      fireEvent.click(screen.getByRole("button", { name: item.calculate }));
      const region = screen.getByRole("region", { name: "계산 결과 공유" });
      let sharedUrl = "";
      await waitFor(() => {
        sharedUrl = resultUrlFromXLink(region) ?? "";
        expect(new URL(sharedUrl).searchParams.has("s")).toBe(true);
      });

      first.unmount();
      window.history.replaceState({}, "", sharedUrl);
      render(<item.Component />);
      await waitFor(() => expect(screen.getByRole("region", { name: "계산 결과 공유" })).toBeInTheDocument());
    });
  }
});
