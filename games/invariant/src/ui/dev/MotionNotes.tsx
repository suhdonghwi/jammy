import { useState, type ReactNode } from 'react';
import { GHOST_RISE } from '../../director/ghosts';
import { BASE, BEAT, EXIT, HOLD, LONG, MICRO, SHORT, TICK } from '../../motion';
import { easeIn, easeInOut, easeOut, smootherstep } from '../../scene/easing';
import { FLIGHT_MAX, FLIGHT_MIN, plan, velocity, type Pose } from '../../scene/flight';
import { SLOWMO } from '../../scene/sceneTime';
import { button, CARD, CARD_LABEL } from '../classes';
import { SCENARIOS } from './motionScenarios';

const BEFORE = '#eb6834';
const AFTER = '#2a78d6';

const s = (v: number) => `${+v.toFixed(2)}s`;

const TOKENS: [string, number, string][] = [
  ['MICRO', MICRO, '호버, 눌림, 코드 커서'],
  ['SHORT', SHORT, '작은 등장·퇴장: tag, ring, 알 재생, slot, 개구리 귀가, 회전'],
  ['EXIT', EXIT, '모든 퇴장 (CSS --duration-exit)'],
  ['BASE', BASE, 'hop, 슬랩 상승, 입력 pop'],
  ['LONG', LONG, '패널, stop/goal 표시 전환, 튜토리얼의 긴 숨'],
  ['TICK', TICK, '연속 hop 사이, 부화 직후'],
  ['BEAT', BEAT, '시퀀스 안 액션 사이의 간격'],
  ['HOLD', HOLD, '결과를 읽는 시간'],
];

const TRIP = 20;
const D = 18;
const OLD_SMOOTH = 0.16;
const pose = (x: number): Pose => ({ x, y: 0, d: D, az: 0.26, po: 0.8 });

function speedSeries() {
  const flight = plan(pose(0), pose(TRIP));
  const w = 2 / OLD_SMOOTH;
  const ts = Array.from({ length: 121 }, (_, i) => (i / 120) * 1.2);
  return {
    dur: flight.dur,
    rows: ts.map((t) => ({ t, before: TRIP * w * w * t * Math.exp(-w * t), after: t <= flight.dur ? Math.abs(velocity(flight, t).x) : 0 })),
  };
}

const PEAK = (() => {
  const { rows } = speedSeries();
  return { before: Math.round(Math.max(...rows.map((r) => r.before))), after: Math.round(Math.max(...rows.map((r) => r.after))) };
})();

interface Change {
  what: string;
  before: string;
  after: string;
}

const CHANGES: { group: string; rows: Change[] }[] = [
  {
    group: 'plane(비축 변수) 전환',
    rows: [
      { what: '판 자체', before: '즉시 교체', after: '즉시 교체 그대로 (애니메이션은 써 보고 뺐음: 같은 판이 바뀌는 wave도, 판이 빠지고 들어오는 교체도 어색했음)' },
      { what: '소리', before: '없음', after: '판이 바뀌는 순간, 근처에서 오르고 내리는 슬랩 수만큼 slabs 효과음' },
      { what: '입력 패널', before: 'busy 동안 패널 전체 흐림, 바뀐 값은 pop만', after: '흐리지 않음. 바뀐 입력 컴포넌트에 링이 켜졌다가 1.2s 동안 빠짐' },
      { what: '다른 판의 counterexample', before: '개구리 귀가 대기 → 아무 표시 없이 즉시 교체 → 250ms → 카메라 대기 250ms → 0.16s SmoothDamp', after: `판도 카메라도 그대로. 규칙 불이 빨개지고 캡션이 "지금 판(n = 4) 근처에는 문제가 없지만, n = 5에서는 깨집니다" + [n = 5에서 보기] 버튼. 누르면 판 즉시 교체 + 소리 → ${s(BEAT)} → 이동 → 착지 0.12s 전에 ghost/frog. (가상 커서, 층 쌓기는 써 보고 뺐음)` },
    ],
  },
  {
    group: '카메라',
    rows: [
      { what: '스크립트 이동', before: 'SmoothDamp, 시간이 거리와 무관 (0.42: 95%까지 약 1.0s, arrive 0.16: 약 0.38s)', after: `거리·줌·회전으로 시간 결정 ${s(FLIGHT_MIN)}–${s(FLIGHT_MAX)}, smootherstep(시작·끝 가속도 0)` },
      { what: `최고 속도 (${TRIP}타일)`, before: `출발 ${Math.round((OLD_SMOOTH / 2) * 1000)}ms 만에 초당 약 ${PEAK.before}타일`, after: `중간쯤 초당 약 ${PEAK.after}타일` },
      { what: '먼 이동', before: '같은 곡선으로 순간이동처럼', after: '1.2화면을 넘으면 가는 거리에 비례해 물러났다 다가감: 중간 지점에서 화면 2.5개 폭이 보이는 높이까지(최대 거리 60)' },
      { what: '화면 뒤쪽 목표', before: '타일이 카메라 뒤에 있으면 투영이 실패해 아예 움직이지 않음 (아주 먼 탈출 counterexample)', after: '타일이 투영되지 않으면 타일들의 중심에서 다시 맞춤' },
      { what: '이동 중 목표 변경', before: '각 축이 따로 재감쇠', after: '현재 속도를 이어받는 quintic Hermite' },
      { what: '이동 전 대기', before: '항상 250ms', after: '60ms (패널이 움직였다면 멈춘 뒤 250ms)' },
      { what: 'arrive()', before: '1.5s와 race (카메라가 움직이는 중 출발 가능)', after: '착지 0.12s 전에 resolve (안전 상한 2.4s)' },
      { what: 'Reset / 각도', before: 'rotateTo와 이동이 각자', after: '위치·거리·각도를 한 flight로' },
      { what: '사용자 입력', before: '-', after: '드래그나 휠이 들어오면 flight를 즉시 멈춤' },
    ],
  },
  {
    group: '시퀀스 간격',
    rows: [
      { what: 'Verification 시작', before: '귀가 + 0.2s', after: `귀가 + TICK ${s(TICK)}` },
      { what: '규칙 그림 (Init/Exit)', before: '1.3s 고정', after: `sweep 1.0s + BEAT = ${s(1 + BEAT)}` },
      { what: '규칙 사이', before: '0.3s', after: `BEAT ${s(BEAT)}` },
      { what: 'Proof 그림', before: '0.6 + 1.0 (근거 없는 1.0)', after: `rise 0.6 + 0.1 + arc 0.45 + ring 0.2 + BEAT = ${s(GHOST_RISE + 0.1 + 0.45 + SHORT + BEAT)}` },
      { what: 'Proof 시작', before: '귀가는 버리고 줌만 대기', after: '귀가와 줌을 함께 대기' },
      { what: '10개 알 테스트', before: '6ms 간격(사실상 동시), 300+6n ms 대기', after: '20ms 물결, 마지막 부화 + TICK' },
      { what: '예제 루프', before: '400 / 650 / 1200 / 500ms', after: 'LONG / 부화 + BEAT / HOLD / LONG' },
      { what: '코드 커서 → ensures', before: '0.45s', after: `BEAT ${s(BEAT)}` },
      { what: '튜토리얼 대기', before: '150, 200, 300, 400, 450, 500, 550, 800, 900, 1000, 1100, 1200ms…', after: 'BEAT · LONG · HOLD · EXIT+TICK 중 하나' },
    ],
  },
  {
    group: '요소별 길이와 곡선',
    rows: [
      { what: '슬랩 상승', before: '0.26s', after: `BASE ${s(BASE)}` },
      { what: 'region ring, 개구리 귀가, 알 slot', before: '0.18s', after: `SHORT ${s(SHORT)}` },
      { what: 'stop/goal/축 표시, 영역 흐림', before: '프레임 지수 lerp (95%까지 약 0.9s / 0.37s)', after: `smootherstep tween LONG ${s(LONG)} / BASE ${s(BASE)}` },
      { what: '홈 바닥 fade', before: '지수 2.6/s', after: '1.2s tween' },
      { what: '장면 안 퇴장 fade', before: '선형', after: 'ease-in (CSS 퇴장과 같은 결)' },
      { what: 'CSS', before: 'rise 0.25, pop 0.3, rise-slow 0.4, slide-in 0.45, 불 0.35, readout 0.15, dialog 0.15, tag 0.25, 커서 0.15, fold 0.3', after: 'rise 0.2, pop 0.34, rise-slow 0.5, slide-in 0.5, 불 0.34, readout 0.12, dialog 0.2, tag 0.2, 커서 0.12, fold 0.34 (모두 --duration-* 토큰)' },
      { what: '움직임 줄이기 설정', before: '장면은 무시', after: '카메라가 물러나지 않음' },
    ],
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${CARD} p-5 max-sm:p-4`}>
      <h2 className="mb-3 font-display text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function SpeedChart() {
  const { rows, dur } = speedSeries();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 220;
  const pad = { l: 44, r: 12, t: 12, b: 30 };
  const maxV = Math.ceil(Math.max(...rows.map((r) => r.before)) / 20) * 20;
  const x = (t: number) => pad.l + (t / 1.2) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / maxV) * (H - pad.t - pad.b);
  const line = (k: 'before' | 'after') => rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.t).toFixed(1)},${y(r[k]).toFixed(1)}`).join('');
  const h = hover === null ? null : rows[hover];
  return (
    <div>
      <Legend items={[[BEFORE, `이전: SmoothDamp ${OLD_SMOOTH}`], [AFTER, `이후: flight ${s(dur)}`]]} />
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const t = (((e.clientX - r.left) / r.width) * W - pad.l) / (W - pad.l - pad.r);
            setHover(Math.round(Math.min(1, Math.max(0, t)) * (rows.length - 1)));
          }}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`${TRIP}타일 이동의 카메라 속도: 이전 최고 ${Math.round(Math.max(...rows.map((r) => r.before)))}타일/초, 이후 최고 ${Math.round(Math.max(...rows.map((r) => r.after)))}타일/초`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={pad.l} x2={W - pad.r} y1={y(maxV * f)} y2={y(maxV * f)} stroke="currentColor" className="text-line" strokeWidth={1} />
              <text x={pad.l - 6} y={y(maxV * f) + 4} textAnchor="end" className="fill-faint text-[11px]">
                {Math.round(maxV * f)}
              </text>
            </g>
          ))}
          {[0, 0.2, 0.4, 0.6, 0.8, 1, 1.2].map((t) => (
            <text key={t} x={x(t)} y={H - 10} textAnchor="middle" className="fill-faint text-[11px]">
              {t}s
            </text>
          ))}
          <path d={line('before')} fill="none" stroke={BEFORE} strokeWidth={2} strokeLinejoin="round" />
          <path d={line('after')} fill="none" stroke={AFTER} strokeWidth={2} strokeLinejoin="round" />
          {h && (
            <g>
              <line x1={x(h.t)} x2={x(h.t)} y1={pad.t} y2={H - pad.b} stroke="currentColor" className="text-faint" strokeWidth={1} />
              <circle cx={x(h.t)} cy={y(h.before)} r={4} fill={BEFORE} stroke="white" strokeWidth={2} />
              <circle cx={x(h.t)} cy={y(h.after)} r={4} fill={AFTER} stroke="white" strokeWidth={2} />
            </g>
          )}
        </svg>
        {h && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg bg-ink/90 px-2.5 py-1.5 font-mono text-xs text-white shadow-card"
            style={{ left: `${(x(h.t) / W) * 100}%`, transform: h.t > 0.7 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)' }}
          >
            <div>t = {h.t.toFixed(2)}s</div>
            <div>이전 {h.before.toFixed(1)} 타일/s</div>
            <div>이후 {h.after.toFixed(1)} 타일/s</div>
          </div>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        {TRIP}타일을 거리 {D}에서 이동할 때 카메라 중심의 속도(타일/초). 이전에는 시간이 거리와 무관해서 멀수록 더 빨랐고, 최고 속도가 출발 직후에 왔습니다.
      </p>
    </div>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      {items.map(([c, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: c }} />
          {label}
        </span>
      ))}
    </div>
  );
}

const CURVES: [string, (u: number) => number, string][] = [
  ['smootherstep', smootherstep, '이동 (카메라, tween)'],
  ['ease-out', easeOut, '등장'],
  ['ease-in', easeIn, '퇴장'],
  ['ease-in-out', easeInOut, '홈 intro'],
];

function Curves() {
  return (
    <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
      {CURVES.map(([name, f, use]) => {
        const d = Array.from({ length: 41 }, (_, i) => `${i ? 'L' : 'M'}${(4 + (i / 40) * 92).toFixed(1)},${(96 - f(i / 40) * 92).toFixed(1)}`).join('');
        return (
          <figure key={name} className="rounded-xl border border-line bg-white p-2">
            <svg viewBox="0 0 100 100" className="aspect-square w-full" role="img" aria-label={`${name} 곡선`}>
              <rect x={4} y={4} width={92} height={92} fill="none" stroke="currentColor" className="text-line" />
              <path d={d} fill="none" stroke={AFTER} strokeWidth={2.5} />
            </svg>
            <figcaption className="mt-1 text-center text-xs">
              <div className="font-mono text-ink">{name}</div>
              <div className="text-faint">{use}</div>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

interface Bar {
  label: string;
  from: number;
  to: number;
  kind: 'motion' | 'wait' | 'mark';
}

function cexTimelines(): { before: Bar[]; after: Bar[] } {
  const oldGlide = 2.4 * OLD_SMOOTH;
  const oldStart = 0.23 + 0.25 + 0.25;
  const oldArrive = oldStart + 0.6;
  const before: Bar[] = [
    { label: '개구리 귀가', from: 0, to: 0.23, kind: 'motion' },
    { label: 'plane 즉시 교체', from: 0.23, to: 0.23, kind: 'mark' },
    { label: '고정 대기 250ms', from: 0.23, to: 0.48, kind: 'wait' },
    { label: '카메라 대기 250ms', from: 0.48, to: oldStart, kind: 'wait' },
    { label: 'SmoothDamp (95%)', from: oldStart, to: oldStart + oldGlide, kind: 'motion' },
    { label: '정지 판정까지 꼬리', from: oldStart + oldGlide, to: oldArrive, kind: 'wait' },
    { label: 'ghost 등장', from: oldArrive, to: oldArrive + GHOST_RISE, kind: 'motion' },
    { label: 'hop → 실패 표시', from: oldArrive + GHOST_RISE + 0.25, to: oldArrive + GHOST_RISE + 0.25 + BASE, kind: 'motion' },
  ];
  const flight = plan(pose(0), pose(12)).dur;
  const switchAt = 0;
  const glideAt = switchAt + BEAT + 0.06;
  const land = glideAt + flight;
  const after: Bar[] = [
    { label: '[n = 5에서 보기] 클릭', from: 0, to: 0, kind: 'mark' },
    { label: '개구리 귀가', from: 0, to: SHORT, kind: 'motion' },
    { label: '판 즉시 교체 + 소리', from: switchAt, to: switchAt, kind: 'mark' },
    { label: '새 판 보여 주기', from: switchAt, to: switchAt + BEAT, kind: 'wait' },
    { label: `flight 12타일 ${s(flight)}`, from: glideAt, to: land, kind: 'motion' },
    { label: 'ghost 등장 (착지 0.12s 전)', from: land - 0.12, to: land - 0.12 + GHOST_RISE, kind: 'motion' },
    { label: 'hop → 실패 표시', from: land - 0.12 + GHOST_RISE + BEAT, to: land - 0.12 + GHOST_RISE + BEAT + BASE, kind: 'motion' },
  ];
  return { before, after };
}

function Timeline({ title, bars, color, span }: { title: string; bars: Bar[]; color: string; span: number }) {
  const W = 640;
  const row = 22;
  const labelW = 190;
  const H = bars.length * row + 26;
  const x = (t: number) => labelW + (t / span) * (W - labelW - 12);
  return (
    <figure className="mb-4">
      <figcaption className="mb-1 text-sm font-semibold text-ink">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}: ${bars.map((b) => `${b.label} ${b.from.toFixed(2)}–${b.to.toFixed(2)}s`).join(', ')}`}>
        {Array.from({ length: Math.floor(span / 0.5) + 1 }, (_, i) => i * 0.5).map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={0} y2={H - 18} stroke="currentColor" className="text-line" />
            <text x={x(t)} y={H - 4} textAnchor="middle" className="fill-faint text-[11px]">
              {t}s
            </text>
          </g>
        ))}
        {bars.map((b, i) => (
          <g key={b.label}>
            <title>{`${b.label}: ${b.from.toFixed(2)}s → ${b.to.toFixed(2)}s`}</title>
            <text x={labelW - 8} y={i * row + 15} textAnchor="end" className="fill-muted text-[12px]">
              {b.label}
            </text>
            {b.kind === 'mark' ? (
              <rect x={x(b.from) - 1.5} y={i * row + 3} width={3} height={row - 6} rx={1.5} fill={color} />
            ) : (
              <rect
                x={x(b.from)}
                y={i * row + 4}
                width={Math.max(3, x(b.to) - x(b.from))}
                height={row - 8}
                rx={4}
                fill={b.kind === 'wait' ? 'none' : color}
                stroke={b.kind === 'wait' ? color : 'none'}
                strokeDasharray={b.kind === 'wait' ? '4 3' : undefined}
                strokeWidth={1.5}
              />
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}

function CexTimelines() {
  const { before, after } = cexTimelines();
  const span = Math.ceil(Math.max(...[...before, ...after].map((b) => b.to)) * 2) / 2;
  return (
    <div>
      <Timeline title="이전" bars={before} color={BEFORE} span={span} />
      <Timeline title="이후" bars={after} color={AFTER} span={span} />
      <p className="text-sm text-muted">
        채운 막대는 움직임, 점선은 아무것도 움직이지 않는 대기입니다. 값은 코드의 상수로 계산했습니다(이전 SmoothDamp의 정지 판정 시점은 근사). 이전에는 plane이 바뀌는 순간에 아무 전환이 없었고, 그 뒤 0.5초 동안 화면이 멈춰 있었습니다.
      </p>
    </div>
  );
}

function Changes() {
  return (
    <div className="flex flex-col gap-5">
      {CHANGES.map(({ group, rows }) => (
        <div key={group}>
          <div className={CARD_LABEL}>{group}</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="w-[22%] py-1.5 pr-3 font-medium">무엇</th>
                  <th className="w-[36%] py-1.5 pr-3 font-medium">이전</th>
                  <th className="py-1.5 font-medium">이후</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.what} className="border-t border-line align-top">
                    <td className="py-2 pr-3 font-medium text-ink">{r.what}</td>
                    <td className="py-2 pr-3 text-muted">{r.before}</td>
                    <td className="py-2 text-ink">{r.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function slowmoHref(n: number) {
  const q = new URLSearchParams(location.search);
  if (n === 1) q.delete('slowmo');
  else q.set('slowmo', String(n));
  return `?${q.toString()}`;
}

export function MotionNotes() {
  const [open, setOpen] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  if (!open)
    return (
      <button className={`${button('glass', 'sm')} fixed right-4 bottom-4 z-50`} onClick={() => setOpen(true)}>
        모션 노트{running ? ` · ${running}` : ''}
      </button>
    );
  const play = (id: string, run: () => Promise<unknown>) => {
    setOpen(false);
    setRunning(id);
    void run().finally(() => setRunning((r) => (r === id ? null : r)));
  };
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-horizon/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 max-sm:py-4">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className={CARD_LABEL}>dev only · ?motion</div>
            <h1 className="font-display text-3xl font-semibold text-ink">모션 노트</h1>
            <p className="mt-1 text-md text-muted">화면 전환과 움직임을 한 기준으로 맞춘 변경을 정리했습니다. 아래 버튼은 이 페이지를 닫고 실제 게임에서 해당 장면을 재생합니다.</p>
          </div>
          <button className={button('plain', 'sm')} onClick={() => setOpen(false)}>
            닫기
          </button>
        </header>

        <Section title="직접 보기">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>슬로모션 (장면 시간만, CSS 제외)</span>
            {[1, 4, 10].map((n) => (
              <a key={n} href={slowmoHref(n)} className={`${button(n === SLOWMO ? 'primary' : 'quiet', 'sm')} mb-0!`}>
                ×{n}
              </a>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
            {SCENARIOS.map((sc) => (
              <button key={sc.id} className="cursor-pointer rounded-xl border border-line bg-white p-3 text-left transition-colors duration-150 hover:bg-sky" onClick={() => play(sc.title, sc.run)}>
                <div className="font-display font-semibold text-ink">{sc.title}</div>
                <div className="mt-0.5 text-sm text-muted">{sc.what}</div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="기준: 토큰">
          <p className="mb-3 text-sm text-muted">
            모든 길이와 간격은 <code className="font-mono">src/motion.ts</code>의 여덟 값 중 하나이고, CSS는 <code className="font-mono">--duration-*</code>로 같은 값을 씁니다. 부화·환호·ghost 상승처럼 강조용 애니메이션만 고유 길이를 유지합니다.
          </p>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {TOKENS.map(([name, v, use]) => (
                <tr key={name} className="border-t border-line first:border-t-0">
                  <td className="w-20 py-1.5 font-mono font-semibold text-ink">{name}</td>
                  <td className="w-16 py-1.5 font-mono text-ink tabular-nums">{s(v)}</td>
                  <td className="py-1.5 text-muted">{use}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4">
            <div className={CARD_LABEL}>곡선은 네 가지</div>
            <Curves />
          </div>
          <div className="mt-4">
            <div className={CARD_LABEL}>순서 규칙</div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
              <li>원인을 먼저 보여 주고 결과를 보여 줍니다 (유저가 버튼을 누르고 → 판이 바뀌고 → 카메라가 감). 판은 유저가 누르지 않으면 바뀌지 않습니다.</li>
              <li>대기를 직렬로 잇지 않고 겹칩니다 (다음 동작은 앞 동작의 약 60–70% 지점에서).</li>
              <li>카메라가 움직이는 동안 주인공은 기다리고, 착지 직전에 출발합니다.</li>
              <li>멀수록 오래 걸리되 상한이 있고, 멀수록 더 높이 물러나서 화면 속 속도는 비슷하게 유지됩니다.</li>
              <li>진행 중에 목표가 바뀌면 속도를 이어받습니다.</li>
            </ol>
          </div>
        </Section>

        <Section title="다른 plane의 counterexample">
          <CexTimelines />
        </Section>

        <Section title="카메라 속도">
          <SpeedChart />
        </Section>

        <Section title="바뀐 것 전부">
          <Changes />
        </Section>

        <Section title="남은 것">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
            <li>결과 캡션이 길면 도착 후 카메라가 한 번 더 움직입니다. 이제 같은 flight라 부드럽지만, 캡션 높이를 미리 확보하는 방식은 아직 아닙니다.</li>
            <li>슬로모션은 장면 시간만 늦춥니다. CSS 애니메이션과 사용자 드래그는 실제 시간 그대로입니다.</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
