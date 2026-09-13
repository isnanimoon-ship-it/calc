import Link from "next/link";
import { getPublishedCalculatorsGroupedByCategory } from "@/src/calculators/registry";

/**
 * Next.js App Router 규칙에 따른 전역 404 페이지 — `notFound()` 호출 시(존재하지 않는
 * slug/category, draft인데 UI가 아직 없는 계산기 등)와 어떤 라우트에도 매치되지 않는
 * URL 모두 이 페이지로 온다. 기존에는 Next.js 기본 404였는데(2026-09-13 지적), 깨진
 * 링크로 들어온 사용자가 홈/카테고리로 바로 돌아갈 수 있게 안내를 추가한다.
 */
export default function NotFound() {
  const groups = getPublishedCalculatorsGroupedByCategory();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-5 py-20 text-center sm:px-8 sm:py-28">
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-7 w-7">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2M9 11h4" strokeLinecap="round" />
        </svg>
      </span>
      <p className="mt-5 text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="mt-3 max-w-md text-base leading-7 text-muted">
        주소가 바뀌었거나 더 이상 존재하지 않는 페이지입니다. 찾으시던 계산기가 있다면
        아래 분류에서 다시 찾아보시거나, 헤더의 검색을 이용해보세요.
      </p>
      <Link
        href="/"
        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <path d="m3 11 9-8 9 8M5 10v10h5v-6h4v6h5V10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        홈으로 가기
      </Link>

      {groups.length > 0 && (
        <div className="mt-12 w-full">
          <p className="text-sm font-semibold text-muted">또는 분류에서 찾아보기</p>
          <ul className="mt-4 flex flex-wrap justify-center gap-2.5">
            {groups.map((group) => (
              <li key={group.category}>
                <Link
                  href={`/categories/${group.category}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-surface-subtle"
                >
                  {group.label}
                  <span className="text-xs font-normal text-muted">{group.calculators.length}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
