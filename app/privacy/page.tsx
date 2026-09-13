import type { Metadata } from "next";

const TITLE = "개인정보처리방침";
const CONTACT_EMAIL = "isnanik@daum.net";
const EFFECTIVE_DATE = "2026-09-13";

export const metadata: Metadata = {
  title: TITLE,
  description: "셈터가 개인정보를 다루는 방식을 안내합니다.",
  alternates: { canonical: "/privacy" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 space-y-2 text-base leading-7 text-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-16 sm:px-8 sm:py-24">
      <header>
        <p className="text-sm font-semibold text-primary">셈터 소개</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
          {TITLE}
        </h1>
        <p className="mt-3 text-base leading-7 text-muted">
          셈터(이하 &ldquo;셈터&rdquo;)는 이용자의 개인정보를 원칙적으로 수집하지 않습니다.
          이 문서는 셈터가 실제로 어떤 정보를 어떻게 다루는지 있는 그대로 설명합니다.
        </p>
      </header>

      <Section title="1. 계산기 이용 시 입력하는 정보">
        <p>
          급여, 생년월일, 자산 규모 등 각 계산기에 입력하는 값은 이용자의 브라우저
          안에서만 계산되며, 셈터의 서버로 전송되거나 저장되지 않습니다. 페이지를
          새로고침하거나 닫으면 입력했던 값은 남지 않습니다.
        </p>
        <p>
          일부 계산기의 &ldquo;결과 공유&rdquo; 기능은 입력값과 결과를 서버가 아니라
          URL 자체에 담아(링크 안에 인코딩) 전달합니다 — 이 URL을 셈터가 별도로
          수집·저장하지 않습니다.
        </p>
      </Section>

      <Section title="2. 자동으로 수집되는 정보">
        <p>
          현재 셈터는 방문자 분석 도구(애널리틱스)나 광고 스크립트, 쿠키를 사용하지
          않습니다. 서버(호스팅 제공업체)가 통상적인 웹서버 접속 로그(IP, 접속 시각,
          요청 페이지 등)를 자체적으로 남길 수 있으나, 셈터가 이를 이용자 식별이나
          다른 목적으로 별도 가공·이용하지 않습니다.
        </p>
      </Section>

      <Section title="3. 문의 시 제공하는 정보">
        <p>
          &ldquo;문의하기&rdquo; 페이지는 이메일 주소({CONTACT_EMAIL})만 안내할 뿐,
          셈터가 별도의 입력 양식으로 문의 내용을 수집하지 않습니다. 이용자가 메일을
          보내면 그 메일에 포함된 이름, 이메일 주소, 문의 내용은 문의 응대 목적으로만
          확인하며, 응대가 끝난 뒤에는 불필요하게 보관하지 않습니다.
        </p>
      </Section>

      <Section title="4. 제3자 제공 및 위탁">
        <p>
          셈터는 개인정보를 제3자에게 제공하거나 외부 업체에 처리를 위탁하지 않습니다.
        </p>
      </Section>

      <Section title="5. 이용자의 권리">
        <p>
          문의를 통해 개인정보를 제공한 경우, 해당 정보의 열람·정정·삭제를 언제든
          {" "}{CONTACT_EMAIL}로 요청할 수 있습니다.
        </p>
      </Section>

      <Section title="6. 개인정보 보호책임자">
        <p>문의처: {CONTACT_EMAIL}</p>
      </Section>

      <Section title="7. 이 방침의 변경">
        <p>
          서비스에 분석 도구나 로그인 기능처럼 개인정보 처리 방식이 실질적으로 바뀌는
          기능이 추가되면 이 문서를 그에 맞게 갱신하고, 변경 사항을 이 페이지에
          반영합니다.
        </p>
        <p className="text-sm">시행일: {EFFECTIVE_DATE}</p>
      </Section>
    </div>
  );
}
