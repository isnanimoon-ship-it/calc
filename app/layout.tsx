import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { CategoryNav } from "@/components/calculator/CategoryNav";
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
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="border-t border-border bg-surface py-8 text-center text-sm text-muted">
          <p>모든 계산은 브라우저 안에서 처리되며 입력값은 저장되지 않습니다.</p>
          <nav aria-label="사이트 정보" className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
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
