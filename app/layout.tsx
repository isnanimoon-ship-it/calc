import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import { ThemeToggle } from "@/components/theme-toggle";
import { CategoryNav } from "@/components/calculator/CategoryNav";
import { SiteSearch } from "@/components/calculator/SiteSearch";
import {
  categoryLabels,
  getPublishedCalculators,
} from "@/src/calculators/registry";
import { siteUrl } from "@/src/lib/site-config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_NAME = "셈터";
const SITE_DESCRIPTION =
  "법령·공식 문서에 근거한 정확한 계산 결과와 산출 근거를 함께 보여주는 온라인 계산기 모음.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteUrl,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  // 네이버 서치어드바이저 사이트 소유 확인용. Next.js `verification` 필드에 등록된 이름
  // (google/yahoo/yandex/me)이 아니므로 `other`에 넣는다 — 렌더 결과는 동일하게
  // <meta name="naver-site-verification" content="..."> 한 줄이다.
  verification: {
    other: {
      "naver-site-verification": "d307af70db06f2afcd38ba4a336b2be4e104d86a",
    },
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: siteUrl,
  description: SITE_DESCRIPTION,
  inLanguage: "ko-KR",
};

// hydration 전에 <html>에 다크모드 클래스를 먼저 설정해 깜빡임(FOUC)을 막는 스크립트.
// localStorage에 저장된 사용자 선택이 있으면 우선하고, 없으면 시스템 설정을 따른다.
const themeInitScript = `
(function () {
  try {
    var stored = window.localStorage.getItem("theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var isDark = stored ? stored === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  // 검색 패널(SiteSearch, 클라이언트 컴포넌트)에 넘길 정적 데이터 — registry.ts 자체가 아니라
  // 이미 계산해 둔 published 목록만 최소 필드로 직렬화해 전달한다.
  const searchableCalculators = getPublishedCalculators().map((calculator) => ({
    slug: calculator.slug,
    title: calculator.title,
    description: calculator.description,
    categoryLabel: categoryLabels[calculator.category],
  }));

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {/* 네이버 애널리틱스(웹로그 분석). docs/PRIVACY 정책 문구와 반드시 함께 갱신할 것 —
            src/calculators 계산기 입력값은 이 스크립트로 전송되지 않는다(계산 자체가
            서버 통신이 없는 순수 클라이언트 로직이라 애초에 보낼 데이터가 없다). 이
            스크립트는 페이지 조회 자체만 집계한다. */}
        <Script src="//wcs.pstatic.net/wcslog.js" strategy="afterInteractive" />
        <Script id="naver-analytics-init" strategy="afterInteractive">
          {`if(!wcs_add) var wcs_add = {};
wcs_add["wa"] = "260cca4e6321980";
if(window.wcs) {
  wcs_do();
}`}
        </Script>
        <header className="border-b border-border bg-surface/85 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
            <Link href="/" className="flex min-w-0 items-center gap-2.5 font-semibold tracking-tight">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]">
                  <rect x="4" y="2" width="16" height="20" rx="3" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="6.5" y="4.5" width="11" height="4" rx="1" fill="currentColor" />
                  <circle cx="7.5" cy="12.5" r="1.1" fill="currentColor" />
                  <circle cx="12" cy="12.5" r="1.1" fill="currentColor" />
                  <circle cx="16.5" cy="12.5" r="1.1" fill="currentColor" />
                  <circle cx="7.5" cy="17" r="1.1" fill="currentColor" />
                  <circle cx="12" cy="17" r="1.1" fill="currentColor" />
                  <circle cx="16.5" cy="17" r="1.1" fill="currentColor" />
                </svg>
              </span>
              <span className="truncate">{SITE_NAME}</span>
            </Link>
            <div className="flex shrink-0 items-center gap-2.5">
              <CategoryNav />
              <SiteSearch calculators={searchableCalculators} />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="border-t border-border bg-surface py-8 text-center text-sm text-muted">
          <nav aria-label="사이트 정보" className="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
            <Link href="/about" className="hover:text-foreground">서비스 소개</Link>
            <Link href="/contact" className="hover:text-foreground">문의하기</Link>
            <Link href="/privacy" className="hover:text-foreground">개인정보처리방침</Link>
            <Link href="/terms" className="hover:text-foreground">이용약관</Link>
          </nav>
          <p className="mt-3 text-xs">&copy; {new Date().getFullYear()} {SITE_NAME}</p>
        </footer>
      </body>
    </html>
  );
}
