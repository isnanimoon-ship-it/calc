"use client";

/**
 * 한명 몰아주기 — 룰렛 애니메이션.
 *
 * ARCHITECTURE.md "5. 애니메이션 컴포넌트 구조" 계약을 그대로 구현한다: 이 컴포넌트는
 * `selectedIndex`(이미 확정된 결과)를 입력받아 그 결과에 맞는 최종 회전각으로 애니메이션할
 * 뿐, 내부에서 결과를 결정하지 않는다 — RNG 인자를 아예 받지 않는다.
 *
 * SVG + CSS 트랜지션만 사용한다(Canvas 금지, ARCHITECTURE.md "5.1"). `onAnimationEnd` 호출
 * 시점은 실제 `transitionend` 이벤트가 아니라 `ROULETTE_ANIMATION_DURATION_MS`와 값이 같은
 * `setTimeout` 기반이다(jsdom 결정적 테스트 가능성, ARCHITECTURE.md "5.4").
 */

import { useEffect, useMemo, useRef, useState } from "react";

export interface RouletteWheelProps {
  /** 부채꼴 라벨(표시용) — 순서가 곧 인덱스. */
  members: string[];
  /** 이미 확정된 결과(calculateWinnerTakeAll의 출력) — 이 컴포넌트는 이 값을 다시 정하지 않는다. */
  selectedIndex: number;
  /** false면 회전 없이 최종 각도로 즉시 정지된 상태를 렌더링한다. */
  playAnimation: boolean;
  /** playAnimation=false면 마운트 시 즉시 호출된다. */
  onAnimationEnd: () => void;
}

/** 회전 애니메이션 지속시간(ms) — onAnimationEnd 타이밍 기준값이기도 하다. */
export const ROULETTE_ANIMATION_DURATION_MS = 3200;

/** 장식용 회전 바퀴 수(결과에 전혀 영향을 주지 않는 연출 전용 상수, ARCHITECTURE.md "5.3"). */
const SPIN_TURNS = 5;

/** ARCHITECTURE.md "7." 가이드라인 — 멤버 10명 초과면 부채꼴 안에는 번호만 표시. */
const NAME_LABEL_THRESHOLD = 10;

const RADIUS = 120;
const CENTER = 130;

/**
 * 부채꼴 색상 — 임의 개수(N=2~20)의 구간을 서로 구분되게 칠해야 해서(순수 장식, 정보
 * 전달 요소 아님) 색상환을 N등분한 HSL을 절차적으로 생성한다. `aria-hidden="true"`가 붙어
 * 스크린리더가 읽는 정보가 아니므로 디자인 토큰 팔레트(2~3색)보다 이 방식이 실용적이다.
 */
function sectorColor(index: number, total: number): string {
  const hue = Math.round((360 / total) * index);
  return `hsl(${hue} 62% 55%)`;
}

/** 각도(0=12시 방향, 시계방향 증가)와 반지름으로 SVG 좌표를 구한다. */
function polarPoint(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(rad), y: CENTER - radius * Math.cos(rad) };
}

export function RouletteWheel({ members, selectedIndex, playAnimation, onAnimationEnd }: RouletteWheelProps) {
  const n = members.length;
  const sectorAngle = 360 / n;
  // 포인터(고정, 12시 방향)에 선택된 부채꼴의 중심이 오도록 하는 최종 각도.
  const targetRotation = -(selectedIndex + 0.5) * sectorAngle;
  const finalRotation = playAnimation ? SPIN_TURNS * 360 + targetRotation : targetRotation;

  // playAnimation=true면 0도(정지 상태)에서 시작해야 회전 애니메이션이 정방향으로 재생된다
  // (finalRotation에서 시작하면 첫 렌더 직후 되감기처럼 보이는 버그가 생긴다). 이 컴포넌트는
  // 매 계산마다 ui.tsx가 `key`를 바꿔 다시 마운트하는 것을 전제로 하므로(아래 참고), 마운트 중
  // playAnimation/selectedIndex가 바뀌는 경우는 없다 — playAnimation=false일 때 초기 상태값이
  // 이미 targetRotation이라 별도로 다시 set할 필요가 없다.
  const [rotation, setRotation] = useState(() => (playAnimation ? 0 : targetRotation));
  const onAnimationEndRef = useRef(onAnimationEnd);
  useEffect(() => {
    onAnimationEndRef.current = onAnimationEnd;
  }, [onAnimationEnd]);

  useEffect(() => {
    if (!playAnimation) {
      onAnimationEndRef.current();
      return;
    }
    const startTimer = window.setTimeout(() => setRotation(finalRotation), 20);
    const endTimer = window.setTimeout(() => onAnimationEndRef.current(), ROULETTE_ANIMATION_DURATION_MS);
    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(endTimer);
    };
    // finalRotation은 playAnimation/selectedIndex/n의 순수 함수라 별도 deps 불필요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playAnimation]);

  const sectors = useMemo(
    () =>
      members.map((name, index) => {
        const start = polarPoint(index * sectorAngle, RADIUS);
        const end = polarPoint((index + 1) * sectorAngle, RADIUS);
        const largeArc = sectorAngle > 180 ? 1 : 0;
        const labelPoint = polarPoint((index + 0.5) * sectorAngle, RADIUS * 0.62);
        const label = n > NAME_LABEL_THRESHOLD ? String(index + 1) : name;
        return { index, d: `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z`, label, labelPoint };
      }),
    [members, sectorAngle, n],
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <svg aria-hidden="true" viewBox={`0 0 ${CENTER * 2} ${CENTER * 2}`} className="h-64 w-64 max-w-full sm:h-72 sm:w-72">
        {/* 포인터(고정, 회전 그룹 밖 — 항상 12시 방향을 가리킨다) */}
        <polygon points={`${CENTER - 9},4 ${CENTER + 9},4 ${CENTER},22`} fill="var(--foreground)" />
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${CENTER}px ${CENTER}px`,
            transition: playAnimation
              ? `transform ${ROULETTE_ANIMATION_DURATION_MS}ms cubic-bezier(0.15, 0.85, 0.35, 1)`
              : "none",
          }}
        >
          {sectors.map((sector) => (
            <g key={sector.index}>
              <path d={sector.d} fill={sectorColor(sector.index, n)} stroke="var(--surface)" strokeWidth={1.5} />
              <text
                x={sector.labelPoint.x}
                y={sector.labelPoint.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={n > 12 ? 9 : 11}
                fontWeight={600}
                fill="#fff"
              >
                {sector.label}
              </text>
            </g>
          ))}
          <circle cx={CENTER} cy={CENTER} r={18} fill="var(--surface)" stroke="var(--border)" strokeWidth={2} />
        </g>
      </svg>
      {/* 이름-번호 매핑 범례 — N>10이면 다이어그램 안 라벨이 번호로 축약되므로 화면에도
          보여 전체 이름을 확인할 수 있게 한다(ARCHITECTURE.md "7."). N<=10이면 부채꼴
          안에 이미 이름이 전부 표시되어 있어 화면에 다시 나열하면 정보가 중복되므로
          (UX/UI Critic Q14 Low) 시각적으로는 숨기되, DOM에는 남겨 스크린리더 사용자에게는
          계속 참여자 목록을 제공한다(LadderAnimation과 보조 정보 수준을 맞춤, Q15 Low). */}
      <ol
        className={
          n > NAME_LABEL_THRESHOLD
            ? "grid w-full grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-3"
            : "sr-only"
        }
      >
        {members.map((name, index) => (
          <li key={index}>
            {index + 1}. {name}
          </li>
        ))}
      </ol>
    </div>
  );
}
