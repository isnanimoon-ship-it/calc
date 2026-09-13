/**
 * 헤더 카테고리 메뉴 — 레지스트리(SSOT)에서 공개된 계산기가 있는 카테고리만 나열하고,
 * 각 항목은 `/categories/[category]` 전용 페이지로 링크한다.
 *
 * 카테고리 이름만으로는 그 안에 어떤 계산기가 있는지 알 수 없다는 피드백(2026-09-13)에
 * 따라, 각 항목 아래에 소속 계산기 이름을 미리보기로 보여준다. 계산기가 계속 늘어나도
 * 목록 높이가 무한정 길어지지 않도록 `line-clamp-2`로 항상 최대 2줄까지만 보여주고
 * 넘치는 항목은 자연스럽게 잘라낸다(전체 목록은 카드를 클릭해 카테고리 페이지에서 확인) —
 * 개수를 세서 "+N개"를 계산하는 로직 없이도 카테고리가 1개든 50개든 항목 높이가 항상
 * 일정하다.
 *
 * 별도 상태 관리 없이 네이티브 `<details>/<summary>`로 구현했다 — 열림/닫힘, 키보드 조작
 * (Enter/Space), 스크린리더 announce가 브라우저 기본 동작으로 전부 제공되어 클라이언트
 * 컴포넌트("use client")나 useState가 필요 없다. 이 사이트가 ThemeToggle 외에는 클라이언트
 * 상태를 헤더에 두지 않던 것과 같은 이유로, 여기서도 최소 JS를 유지한다.
 *
 * 320px에서 로고+메뉴+테마토글이 한 줄에 들어가야 해서(docs/DESIGN_SYSTEM.md 가로 스크롤
 * 금지), 좁은 화면에서는 아이콘만(테마토글과 동일한 h-10 w-10 정사각형), `sm` 이상에서만
 * "카테고리" 텍스트와 화살표를 덧붙인다. 드롭다운 폭도 같은 이유로 320px 기준
 * `w-56`(224px)까지만 허용한다 — 메뉴 버튼이 헤더 오른쪽에 붙어있어 폭을 더 넓히면
 * 왼쪽으로 뷰포트 밖까지 삐져나간다(직접 계산해 확인한 값). `sm` 이상에서는 뷰포트가
 * 넉넉해지므로 `w-72`(288px)로 넓혀 미리보기 텍스트가 잘리지 않게 한다.
 */
import Link from "next/link";
import {
  getPublishedCalculatorsGroupedByCategory,
  type CalculatorMeta,
} from "@/src/calculators/registry";

/** 미리보기용으로 제목 끝의 "계산기"를 뗀다 — 이미 "카테고리 메뉴" 문맥이라 반복이 불필요하다. */
function shortTitle(title: string): string {
  return title.replace(/\s*계산기$/, "");
}

function previewText(calculators: CalculatorMeta[]): string {
  return calculators.map((calculator) => shortTitle(calculator.title)).join(" · ");
}

export function CategoryNav() {
  const groups = getPublishedCalculatorsGroupedByCategory();

  // 공개된 계산기가 하나도 없으면(이론상 초기 상태) 빈 메뉴를 보여주지 않는다 — 홈페이지의
  // "빈 카테고리 섹션은 렌더링하지 않는다" 원칙과 동일하다.
  if (groups.length === 0) {
    return null;
  }

  return (
    <nav aria-label="카테고리">
      <details className="group relative">
        <summary
          aria-label="카테고리 메뉴 열기"
          className="flex h-10 w-10 cursor-pointer list-none items-center justify-center gap-1.5 rounded-xl border border-border bg-surface text-sm font-semibold text-muted transition-colors hover:border-border-strong hover:bg-surface-subtle hover:text-foreground sm:w-auto sm:px-4 [&::-webkit-details-marker]:hidden"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 sm:h-4 sm:w-4">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
          <span className="hidden sm:inline">카테고리</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="hidden h-4 w-4 transition-transform group-open:rotate-180 sm:inline-block">
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <ul className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface py-1.5 shadow-[0_18px_45px_-28px_rgba(16,24,40,.45)] sm:w-72">
          {groups.map((group) => (
            <li key={group.category}>
              <Link
                href={`/categories/${group.category}`}
                className="block px-4 py-2.5 transition-colors hover:bg-surface-subtle"
              >
                <span className="flex items-center justify-between text-sm font-semibold text-foreground">
                  {group.label}
                  <span className="text-xs font-normal text-muted">{group.calculators.length}</span>
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted">
                  {previewText(group.calculators)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
