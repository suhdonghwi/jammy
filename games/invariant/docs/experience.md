# Invariant Frog — Experience

How the interface should look, move and respond. These are the principles
behind many small decisions; keep them when changing or adding UI.

## Nothing pops

- **Everything that appears or disappears animates**: dialogs, the level list,
  captions, toasts, tags in the scene. Entrances fade or rise in (about 0.2 s);
  exits play a short reverse (`EXIT_MS`, 150 ms). Use the presence helpers in
  `ui/presence.ts` rather than unmounting things outright.
- **Quick, never sluggish.** Dialog and caption animations are short; the
  learner should never wait on decoration.
- **No layout shift.** Reserve space up front (the 3D title has a fixed aspect;
  a caption's button row is always as tall as a primary button with its 3D
  edge), open new rows smoothly (`RevealSlot`, the code panel's assert line),
  keep a panel's width from following its content (the assert line clips
  instead), and show errors inside the box they belong to rather than pushing
  things around.
- **The first frame is already right.** The camera is placed before anything is
  drawn, and the world and title fade in instead of jumping into place.
- **Screens hand over, they don't cut.** Opening the level list fades the home
  copy back behind it; finishing the tutorial shows the rules card over it and
  only moves on once it is closed; coming back from a level shows the level list
  at once (no fade-in fighting the scene's own entrance).

## Motion in the scene

- **Continuous motion.** A hop accelerates, flies and lands without any jerk;
  frogs sharing a tile glide into their slots and arrive exactly on landing;
  slabs rise and sink rather than appear. Prefer curves that are smooth in both
  position and speed.
- **Every movement means something.** A frog turns (with a tiny hop) only when
  its next hop goes another way; it cheers only when it lands on a goal; the
  code panel lights the loop body while frogs hop and flashes the condition when
  they land.
- **Visible, not loud.** A goal landing should be noticed (a ripple, a flash, the
  pool's light column brightening) without becoming a splash.
- **Things come from somewhere.** Frogs climb out of their egg, from where the
  egg sat; ghost frogs arrive in the hand's palm; the hand points at the thing
  itself.
- **The scene pauses when the page is hidden** and carries on where it was. All
  scene timing runs on scene time (see architecture.md), never the wall clock.

## Clarity

- **One component per idea.** Every label in the scene (tutorial callouts,
  failure labels, a frog's values) is the same tag: it rides with its frog,
  scales with distance, and steps aside when another label covers the same
  spot. Don't invent a second kind.
- **Hierarchy you can read at a glance.** Primary actions are blue "toy"
  buttons; ordinary ones are white; secondary ones are quiet (a faint pill on
  panels, a grey glass pill over the scene). A secondary button must look
  secondary, and still be clearly visible.
- **Quiet buttons keep their pill at rest**, so their edges line up with what's
  around them; bare text looks misaligned until hovered.
- **Consistent labels.** The same action has the same short label everywhere
  (e.g. always "Next"); change the caption, not the button. One icon per
  meaning, never two.
- **Captions are written, not dumped.** They use light Markdown (paragraphs,
  lists, bold, inline code for states and formulas), name concrete values
  (`i = 1, n = 0`), and avoid italics.
- **Draw what doesn't exist faintly**, rather than not at all: states the
  precondition rules out are ghost tiles, still hoverable, and the readout says
  they are not possible states.
- **Optical alignment matters.** Centre things on what the eye sees (a button
  with its 3D bottom edge, monospace digits that sit high, the visual centre of
  a row), and keep rings and outlines even on all sides.

## The tutorial

- **The caption comes first**, then the scene change it describes.
- **Next is always clickable.** Pressed while a step is still playing, it skips
  ahead: the next step's scene is rebuilt at once. Nothing is queued and the
  learner never waits for an animation to finish.
- **Back is always there** (after the first step) and rebuilds the previous
  step's starting scene immediately.
- **Only what the step asks for is enabled.** Step, Run, eggs and the formula
  box are locked otherwise, so the learner can't break the story.
- **Any formula is a valid move** once a stage asks for one: the story
  branches on which rule failed, never on what was typed. A failure's caption
  stays (with Replay) while the learner fixes the area; the ask is not
  repeated.
- **One hint per stage**, a single sentence behind a Hint button. Pressing it
  adds the sentence under the stage's ask, and the button goes. In levels the
  Hint button stays: it shows the first hint in the caption, with "Another
  hint" for the next; pressed again later, it brings back the ones asked for.
- **Predict before you see.** Before a pitfall is demonstrated, the caption
  asks a yes-or-no question about it. Never scored; it only makes the learner
  commit.
- **Spotlight** whatever the caption is talking about.
- A very fast double click must not press two buttons.

## Layout

- Desktop first; the 3D scene is full-screen and panels float over it.
- Narrow or tall windows stack the home copy under the scene; very small
  screens show only the copy. Level panels shrink on narrow screens.
- Spacing, type and radii come from Tailwind's scales (plus a 15 px text size
  for the UI's base). Small deviations from a mock-up are fine for the sake of
  consistency.
