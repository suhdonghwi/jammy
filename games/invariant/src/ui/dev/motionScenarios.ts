import { check, openLevel, resetScreen } from '../../game/actions';
import { useGame } from '../../game/store';
import { levels } from '../../levels/catalog';
import { cameraRig } from '../../scene/cameraRig';
import { SLOWMO } from '../../scene/sceneTime';

export interface Scenario {
  id: string;
  title: string;
  what: string;
  run: () => Promise<unknown>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms * SLOWMO));

async function until(ok: () => boolean) {
  while (!ok()) await new Promise((r) => setTimeout(r, 50));
}

const idle = () => {
  const g = useGame.getState();
  return !g.busy && !g.checking && !g.running && !g.stepping;
};

async function open(id: string) {
  const g = useGame.getState();
  if (g.mode !== 'level' || g.level?.id !== id) {
    openLevel(levels.find((l) => l.id === id)!);
    await until(() => useGame.getState().level?.id === id && useGame.getState().mode === 'level');
  }
  await until(() => document.documentElement.dataset.started !== undefined && idle());
  await wait(600);
}

async function tryFormula(id: string, formula: string) {
  await open(id);
  useGame.getState().setFormula(formula);
  await wait(400);
  await check();
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'cex-plane',
    title: '다른 plane의 counterexample',
    what: 'Tag Along에서 i <= 4를 Check. 개구리가 들어가고, n 입력이 강조되며, 화면 중심부터 plane wave가 퍼진 뒤 카메라가 출발합니다.',
    run: () => tryFormula('tag-along', 'i <= 4'),
  },
  {
    id: 'wave',
    title: '입력 바꾸기 (+/−)',
    what: 'n을 6 → 2 → 9로 바꿉니다. 슬랩·바닥·알·goal column이 물결처럼 넘어가고 개구리는 줄어들며 사라집니다.',
    run: async () => {
      await open('tag-along');
      useGame.getState().setFormula('i <= n');
      for (const n of [6, 2, 9]) {
        useGame.setState({ inputs: { n } });
        await wait(1400);
      }
    },
  },
  {
    id: 'glide',
    title: '카메라 이동 세 가지',
    what: '가까운 이동(짧고 부드럽게), 먼 이동(조금 물러났다가 다가감), 아주 먼 이동(안개로 흐려졌다가 넘어감)을 차례로.',
    run: async () => {
      await open('tag-along');
      const go = (x: number, y: number) => cameraRig.frame({ at: [x, y, 15], focus: [[x, y]] });
      await go(5, 6);
      await wait(500);
      await go(40, 26);
      await wait(500);
      await go(400, 40);
      await wait(500);
      await go(2, 4);
    },
  },
  {
    id: 'proof',
    title: '통과하는 Check',
    what: 'Tag Along의 정답 i <= n. 규칙마다 그림 → 불 → 정리 → beat 순서가 같은 토큰으로 이어집니다.',
    run: () => tryFormula('tag-along', 'i <= n'),
  },
  {
    id: 'reset',
    title: 'Reset',
    what: 'n을 바꾸고 카메라를 옮긴 뒤 Reset. 입력이 wave로 돌아가고 카메라는 한 번의 flight(각도 포함)로 처음 view로 갑니다.',
    run: async () => {
      await open('tag-along');
      useGame.setState({ inputs: { n: 8 } });
      await cameraRig.frame({ at: [12, 20, 22], focus: [[12, 20]] });
      await wait(700);
      resetScreen();
    },
  },
];
