import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCalculatorBySlug,
  getPublishedCalculators,
} from "@/src/calculators/registry";
import { calculatorComponents } from "@/src/calculators/calculator-components";
import { severancePayFaqSeoItems } from "@/src/calculators/severance-pay/seo-content";
import { weeklyHolidayAllowanceFaqSeoItems } from "@/src/calculators/weekly-holiday-allowance/seo-content";
import { fourMajorInsuranceFaqSeoItems } from "@/src/calculators/four-major-insurance/content";
import { militaryDischargeFaqSeoItems } from "@/src/calculators/military-discharge-date/content";
import { businessDaysFaqSeoItems } from "@/src/calculators/business-days/content";
import { parentalLeaveBenefitFaqSeoItems } from "@/src/calculators/parental-leave-benefit/content";
import { ageCalculatorFaqSeoItems } from "@/src/calculators/age-calculator/content";
import { bmiFaqSeoItems } from "@/src/calculators/bmi-calculator/content";
import { militarySalaryFaqSeoItems } from "@/src/calculators/military-salary/content";
import { housingSubscriptionScoreFaqSeoItems } from "@/src/calculators/housing-subscription-score/content";
import { annualSalaryTakeHomePayFaqSeoItems } from "@/src/calculators/annual-salary-take-home-pay/content";
import { loanInterestCalculatorFaqSeoItems } from "@/src/calculators/loan-interest-calculator/content";
import { billSplitCalculatorFaqSeoItems } from "@/src/calculators/bill-split-calculator/content";
import { averageCostCalculatorFaqSeoItems } from "@/src/calculators/average-cost-calculator/content";
import { dDayCalculatorFaqSeoItems } from "@/src/calculators/d-day-calculator/content";
import { npbFaqSeoItems } from "@/src/calculators/national-pension-benefit-estimate/content";
import { bmrFaqSeoItems } from "@/src/calculators/bmr-calculator/content";
import { housingAcquisitionTaxFaqSeoItems } from "@/src/calculators/housing-acquisition-tax/content";
import { annualLeaveAllowanceFaqSeoItems } from "@/src/calculators/annual-leave-allowance/content";
import { minimumWageCalculatorFaqSeoItems } from "@/src/calculators/minimum-wage-calculator/content";
import { siteUrl } from "@/src/lib/site-config";

type CalculatorPageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * slug → UI 컴포넌트 매핑.
 *
 * status가 draft인 계산기도 여기 등록해 두면 라우팅 자체는 동작한다 — 이래야 sitemap/홈에는
 * 아직 노출되지 않아도(레지스트리 status가 draft인 동안) QA/내부 검토자가 URL을 직접
 * 입력해 페이지를 확인할 수 있다(registry.ts의 status는 Builder 권한 밖이므로 건드리지 않는다).
 * 계산기가 늘어나면 이 맵에 항목을 추가한다.
 */
const faqItemsBySlug = {
  "severance-pay": severancePayFaqSeoItems,
  "weekly-holiday-allowance": weeklyHolidayAllowanceFaqSeoItems,
  "four-major-insurance": fourMajorInsuranceFaqSeoItems,
  "military-discharge-date": militaryDischargeFaqSeoItems,
  "business-days": businessDaysFaqSeoItems,
  "parental-leave-benefit": parentalLeaveBenefitFaqSeoItems,
  "age-calculator": ageCalculatorFaqSeoItems,
  "bmi-calculator": bmiFaqSeoItems,
  "military-salary": militarySalaryFaqSeoItems,
  "housing-subscription-score": housingSubscriptionScoreFaqSeoItems,
  "annual-salary-take-home-pay": annualSalaryTakeHomePayFaqSeoItems,
  "loan-interest-calculator": loanInterestCalculatorFaqSeoItems,
  "bill-split-calculator": billSplitCalculatorFaqSeoItems,
  "average-cost-calculator": averageCostCalculatorFaqSeoItems,
  "d-day-calculator": dDayCalculatorFaqSeoItems,
  "national-pension-benefit-estimate": npbFaqSeoItems,
  "bmr-calculator": bmrFaqSeoItems,
  "housing-acquisition-tax": housingAcquisitionTaxFaqSeoItems,
  "annual-leave-allowance": annualLeaveAllowanceFaqSeoItems,
  "minimum-wage-calculator": minimumWageCalculatorFaqSeoItems,
} as const;

/**
 * 정적 생성 대상 slug 목록 — 레지스트리 기반, published만 포함한다.
 * draft 계산기는 이 목록에 없으므로 SSG 대상에서 자동으로 빠지지만, 존재 자체는
 * getCalculatorBySlug()로 확인되므로 요청 시점 렌더링(dynamicParams 기본값)으로 여전히
 * 접근 가능하다 — 아래 default export 참고. sitemap/robots/홈 목록 노출 여부만 이 함수로
 * 제어되고, 라우팅 자체를 막는 것은 아니다.
 */
export function generateStaticParams() {
  return getPublishedCalculators().map((calculator) => ({
    slug: calculator.slug,
  }));
}

export async function generateMetadata({
  params,
}: CalculatorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const calculator = getCalculatorBySlug(slug);

  if (!calculator || calculator.status !== "published") {
    return {};
  }

  return {
    title: calculator.title,
    description: calculator.description,
    alternates: {
      // 쿼리스트링 등 화면 상태와 무관하게 canonical을 고정한다 (docs/ARCHITECTURE.md SEO 규칙 3번).
      canonical: `/calculators/${calculator.slug}`,
    },
  };
}

export default async function CalculatorPage({ params }: CalculatorPageProps) {
  const { slug } = await params;
  const calculator = getCalculatorBySlug(slug);

  // 레지스트리에 아예 없는 slug만 404 처리한다. status가 "draft"인 계산기는
  // sitemap/robots/홈/카테고리 목록(getPublishedCalculators() 기반)에는 노출되지 않지만,
  // URL을 직접 알고 접근하면 라우팅 자체는 되어야 QA/내부 검토자가 배포 전에 확인할 수 있다
  // (registry.ts의 status를 published로 바꾸는 것은 Calculation Auditor/QA 통과 이후의
  // 별도 절차이며 Builder 권한 밖이다 — 여기서는 status를 참조만 하고 수정하지 않는다).
  if (!calculator) {
    notFound();
  }

  const CalculatorUi = calculatorComponents[slug];

  // 레지스트리에는 등록됐지만 아직 ui.tsx가 연결되지 않은 계산기(구현 진행 중)는 404 처리한다.
  if (!CalculatorUi) {
    notFound();
  }

  const faqItems = faqItemsBySlug[slug as keyof typeof faqItemsBySlug] ?? [];
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: calculator.title,
      description: calculator.description,
      url: `${siteUrl}/calculators/${calculator.slug}`,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
    },
    ...(faqItems.length
      ? [{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }]
      : []),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <CalculatorUi />
    </>
  );
}
