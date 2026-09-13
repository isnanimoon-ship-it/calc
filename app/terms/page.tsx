import type { Metadata } from "next";

const TITLE = "이용약관";
const CONTACT_EMAIL = "isnanik@daum.net";
const EFFECTIVE_DATE = "2026-09-13";

export const metadata: Metadata = {
  title: TITLE,
  description: "셈터 이용약관입니다.",
  alternates: { canonical: "/terms" },
};

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">
        {number}. {title}
      </h2>
      <div className="mt-2 space-y-2 text-base leading-7 text-muted">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-16 sm:px-8 sm:py-24">
      <header>
        <p className="text-sm font-semibold text-primary">셈터 소개</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
          {TITLE}
        </h1>
        <p className="mt-3 text-base leading-7 text-muted">
          이 약관은 셈터(이하 &ldquo;셈터&rdquo;)가 제공하는 온라인 계산기 서비스의
          이용 조건을 정합니다.
        </p>
      </header>

      <Section number={1} title="목적">
        <p>
          이 약관은 셈터가 제공하는 계산기 서비스(이하 &ldquo;서비스&rdquo;)의 이용과
          관련해 셈터와 이용자 사이의 권리·의무 및 책임 사항을 정하는 것을 목적으로
          합니다.
        </p>
      </Section>

      <Section number={2} title="서비스의 내용">
        <p>
          서비스는 법령·공식 문서 등에 근거해 계산 결과와 그 산출 근거를 제공하는
          온라인 계산기 모음입니다. 회원가입 없이 누구나 무료로 이용할 수 있습니다.
        </p>
      </Section>

      <Section number={3} title="참고용 정보라는 점">
        <p>
          서비스가 제공하는 모든 계산 결과는 입력한 값과 서비스가 파악한 시점의
          법령·고시·공식을 근거로 한 <strong className="text-foreground">참고용 추정치</strong>이며,
          법적 효력이 있는 확정 금액이나 공식 판단을 대신하지 않습니다. 법령·고시는
          개정될 수 있고, 개별 사정에 따라 실제 결과와 차이가 날 수 있습니다. 중요한
          결정을 내리기 전에는 관련 기관이나 전문가를 통해 별도로 확인하시기 바랍니다.
        </p>
      </Section>

      <Section number={4} title="이용자의 의무">
        <p>이용자는 서비스를 이용할 때 다음 행위를 해서는 안 됩니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>서비스의 정상적인 운영을 방해하는 비정상적인 방법으로 접근하는 행위</li>
          <li>서비스를 무단으로 복제·수정하거나 재배포하는 행위</li>
          <li>관계 법령을 위반하는 목적으로 서비스를 이용하는 행위</li>
        </ul>
      </Section>

      <Section number={5} title="면책조항">
        <p>
          셈터는 계산 결과의 정확성을 높이기 위해 노력하지만, 서비스 이용 및 계산
          결과에 대한 신뢰를 바탕으로 이용자가 내린 결정이나 그로 인해 발생한 손해에
          대해 법이 허용하는 한도 내에서 책임을 지지 않습니다. 오류를 발견하면{" "}
          <a href="/contact" className="font-semibold text-primary hover:underline">
            문의하기
          </a>
          로 알려주시면 확인 후 반영합니다.
        </p>
        <p>
          천재지변, 시스템 장애, 호스팅 서비스 중단 등 셈터가 통제할 수 없는 사유로
          서비스가 일시 중단되거나 종료될 수 있습니다.
        </p>
      </Section>

      <Section number={6} title="지적재산권">
        <p>
          서비스의 디자인, 문구, 소스코드 등에 대한 권리는 셈터에 있습니다. 계산의
          근거가 되는 법령·공식 자체는 공개된 정보이며, 이를 인용·설명하는 것은
          권리 침해에 해당하지 않습니다.
        </p>
      </Section>

      <Section number={7} title="서비스의 변경 및 중단">
        <p>
          셈터는 서비스의 내용을 추가·변경하거나 운영상·기술상 필요에 따라 서비스의
          전부 또는 일부를 중단할 수 있습니다. 중요한 변경 사항은 이 페이지나 서비스
          화면을 통해 안내합니다.
        </p>
      </Section>

      <Section number={8} title="약관의 변경">
        <p>
          이 약관은 필요한 경우 개정될 수 있으며, 개정된 약관은 이 페이지에 게시한
          시점부터 효력이 발생합니다.
        </p>
      </Section>

      <Section number={9} title="문의">
        <p>약관에 대한 문의는 {CONTACT_EMAIL}로 보내주세요.</p>
        <p className="text-sm">시행일: {EFFECTIVE_DATE}</p>
      </Section>
    </div>
  );
}
