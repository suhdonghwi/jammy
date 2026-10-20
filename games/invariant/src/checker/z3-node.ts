import { init, type Context } from 'z3-solver';
import { guardDecRefs } from './z3-guard';

let api: Awaited<ReturnType<typeof init>> | null = null;
let ctx: Context<'main'> | null = null;

export async function nodeZ3(): Promise<Context<'main'>> {
  if (!ctx) {
    api = await init();
    guardDecRefs(api.Z3);
    ctx = api.Context('main');
  }
  return ctx;
}

export async function shutdownZ3(): Promise<void> {
  if (!api) return;
  const { killThreads } = await import('z3-solver');
  await killThreads(api.em);
}
