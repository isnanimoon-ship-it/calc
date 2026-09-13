import type { Metadata } from "next";
import Link from "next/link";

const TITLE = "서비스 소개";
const DESCRIPTION = "셈터가 계산 결과를 만드는 방식과 지키는 원칙을 소개합니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-16 sm:px-8 sm:py-24">
      <header>
        <p className="text-sm font-semibold text-primary">셈터 소개</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
          {TITLE}
        </h1>
        <p className="mt-3 text-base leading-7 text-muted">
          &ldquo;셈터&rdquo;는 &ldquo;셈&rdquo;(계산)과 &ldquo;터&rdquo;(장소)를 합친 이름입니다.
          복잡한 법령·금융 공식을 대신 계산해 드리고, 그 결과가 어떻게 나왔는지까지
          투명하게 보여드리는 것을 목표로 합니다.
        </p>
      </header>

      <section className="mt-10 space-y-8">
        <div>
          <h2 className="text-lg font-bold">계산 근거를 함께 보여드립니다</h2>
          <p className="mt-2 text-base leading-7 text-muted">
            숫자 하나만 던져주는 계산기가 아니라, 어떤 법 조항·공식·기준연도를 근거로
            그 값이 나왔는지 계산 과정을 함께 표시합니다. 결과를 그대로 믿기보다,
            직접 검증하거나 상황에 맞게 응용할 수 있도록 돕기 위해서입니다.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-bold">입력값은 브라우저 밖으로 나가지 않습니다</h2>
          <p className="mt-2 text-base leading-7 text-muted">
            급여, 자산, 개인 일정 등 계산기에 입력하는 값은 모두 사용자의 브라우저
            안에서만 계산되며, 서버로 전송되거나 저장되지 않습니다. 자세한 내용은{" "}
            <Link href="/privacy" className="font-semibold text-primary hover:underline">
              개인정보처리방침
            </Link>
            에서 확인할 수 있습니다.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-bold">그래도 참고용 추정치입니다</h2>
          <p className="mt-2 text-base leading-7 text-muted">
            법령·고시는 개정될 수 있고, 계산기마다 다루지 않는 예외 상황이 있을 수
            있습니다. 각 계산기 결과 화면에 표시된 전제와 한계를 함께 확인하고, 중요한
            결정에는 관련 기관의 공식 확인 절차를 거치는 것을 권장합니다.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-bold">계속 늘어나는 계산기</h2>
          <p className="mt-2 text-base leading-7 text-muted">
            노동·금융·세금·날짜·건강·생활 등 실생활에서 자주 필요한 계산기를 하나씩
            추가하고 있습니다. 필요한 계산기나 개선하면 좋을 점이 있다면{" "}
            <Link href="/contact" className="font-semibold text-primary hover:underline">
              문의하기
            </Link>
            로 알려주세요.
          </p>
        </div>
      </section>
    </div>
  );
}
