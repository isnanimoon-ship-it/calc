import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 이 프로젝트는 CLAUDE.md를 역할 기반 개발 체계(.claude/agents/*.md)의 문서 인덱스로
  // 직접 관리한다. `next dev`가 자동으로 AGENTS.md/CLAUDE.md에 안내 블록을 덧붙이는
  // 기본 동작(agentRules)을 끈다 — docs/ARCHITECTURE.md, CLAUDE.md 등은 사람이 직접 관리한다.
  agentRules: false,
};

export default nextConfig;
