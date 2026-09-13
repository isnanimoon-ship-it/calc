import type { Metadata } from "next";

const TITLE = "문의하기";
const CONTACT_EMAIL = "isnanik@daum.net";
const DESCRIPTION = `계산 오류 제보, 새 계산기 제안, 기타 문의는 ${CONTACT_EMAIL}로 보내주세요.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-16 sm:px-8 sm:py-24">
      <header>
        <p className="text-sm font-semibold text-primary">셈터 소개</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
          {TITLE}
        </h1>
        <p className="mt-3 text-base leading-7 text-muted">
          계산 결과가 실제 법령·공식과 다르다고 느껴지거나, 새로운 계산기가 있으면
          좋겠다고 생각되는 점이 있다면 언제든 알려주세요.
        </p>
      </header>

      <section className="mt-10 rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <h2 className="text-lg font-bold">이메일로 문의하기</h2>
        <p className="mt-2 text-base leading-7 text-muted">
          아래 주소로 메일을 보내주시면 확인 후 답변드립니다. 계산기 이름과 입력했던
          값을 함께 적어주시면 오류를 더 빠르게 확인할 수 있습니다.
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {CONTACT_EMAIL}
        </a>
      </section>

      <section className="mt-8 rounded-2xl bg-surface-subtle p-6">
        <h2 className="text-base font-semibold">이런 문의를 환영합니다</h2>
        <ul className="mt-3 space-y-1.5 text-sm leading-6 text-muted">
          <li>계산 결과가 실제 법령·공식·공식 계산기와 다른 것 같은 경우</li>
          <li>필요한 계산기가 아직 없는 경우</li>
          <li>화면이 깨지거나 특정 기기·브라우저에서 동작하지 않는 경우</li>
          <li>기타 개선 제안</li>
        </ul>
      </section>
    </div>
  );
}
