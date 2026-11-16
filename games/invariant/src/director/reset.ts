import { useGame } from '../game/store';
import { field } from '../scene/area/field';
import { frogWorld } from '../scene/frogs/frogWorld';
import { hopArcs } from '../scene/frogs/HopArcs';
import { hatchFx } from '../scene/frogs/Hatch';
import { clearTrace } from './codeTrace';
import { sendFrogsHome } from './frogs';
import { abandonCheck, begin } from './sequence';

export function interrupt() {
  begin();
  abandonCheck();
  clearTrace();
  frogWorld.clear();
  hatchFx.clear();
  hopArcs.clear();
  useGame.setState({ busy: false, running: false, stepping: false, failMark: null, pending: [], inputCue: null, inputDraft: null, ghost: null });
}

export function resetLevel() {
  interrupt();
  field.reset();
}

export function resetFrogs() {
  begin();
  clearTrace();
  void sendFrogsHome();
  useGame.setState({ running: false, failMark: null });
}
