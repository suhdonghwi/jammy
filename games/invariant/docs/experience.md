# Invariant Frog — Experience

How the interface should look, move and respond. These are the principles
behind many small decisions; keep them when changing or adding UI.

## Nothing pops

- **Everything that appears or disappears animates**: dialogs, the level
  list, captions, toasts, tags in the scene. Entrances fade or rise in on the
  one entrance curve, `--ease-entrance` (quick, then settling): about 0.2 s
  for small things, up to 0.5 s for panels and the home copy. Rows and panels
  that open or fold share a gentler curve. Exits play a short reverse
  (`EXIT_MS`, 150 ms), except that a caption replaced by another just gives
  way to it. Use the presence helpers in `hooks/presence.ts` rather than
  unmounting outright. In the scene, frogs leave through `dismissFrogs` (they
  shrink away, ghosts fade, their eggs grow back) and tags and outlines
  through `useExitFade`. Only a rebuild (Back, skipping ahead) may cut.
- **Quick, never sluggish.** The learner should never wait on decoration.
- **No layout shift.** Reserve space up front (the 3D title has a fixed
  aspect; a caption's button row is always as tall as a primary button with
  its 3D edge), open new rows smoothly (`RevealSlot`), keep a panel's width
  from following its content, and show errors inside the box they belong to.
- **The first frame is already right.** The camera is placed before anything
  is drawn, and the world and title fade in. Until then the page is a plain
  backdrop; if starting takes over a second, a small loader (three hopping
  tiles) fades in, and crossfades into the scene.
- **Screens hand over, they don't cut.** A new screen fades the old one out
  first. Opening the level list fades the home copy back behind it;
  finishing the tutorial shows the rules card over it and moves on once it
  is closed; coming back from a level brings the level list in with the home
  scene, not after it.

## Motion in the scene

- **Continuous motion.** A hop accelerates, flies and lands without any jerk;
  frogs sharing a tile glide into their slots and arrive exactly on landing;
  slabs rise and sink rather than appear. Prefer curves that are smooth in
  both position and speed.
- **Every movement means something.** A frog turns (with a tiny hop) only
  when its next hop goes another way; it cheers only when it lands on a goal.
  The code panel's cursor walks the lines a hop runs (following the last of
  the frogs hopping together, so after Run the longest run), then sits on the
  `while` line, green with a tick if the loop goes on, amber with a cross if
  it stops, and drops to cover the `ensures` lines when the loop ends.
- **Visible, not loud.** A goal landing should be noticed (a ripple, a flash,
  the pool's light column brightening) without becoming a splash.
- **Things come from somewhere.** Frogs climb out of their egg; a frog that
  is done goes back into it, and the egg grows back. Ghost frogs break up
  through the slab of the tile they test (chips fly off), spinning as they
  rise, to a siren that plays once per wave.
- **The scene pauses when the page is hidden** and carries on where it was.

## Verifying

- **Every verification plays the same way**, whether Check in a level, Check
  in the tutorial, or a what-if after a yes/no: frogs out on the board go
  home first, then each rule is shown in turn in the scene, and only then
  does the caption say what happened.
- **One rule at a time, with a visible seam.** Every light to be checked
  spins from the press. Each rule's picture plays in turn: Initialization
  rings the eggs in view in one sweep along their line, with rising ticks,
  the last tick on the last ring; Maintenance raises ghost frogs together,
  spread apart and fading with distance, each drawing its dashed hop and
  ringing its landing tile; Termination sweeps every stop on the area like
  the eggs. Then the light turns, the picture clears, and a short pause
  separates it from the next rule. A rule that holds gets a green tag near
  the middle of the view, as a failure gets its red one. The first failing
  rule ends the check; an undecided one gets an amber light with a question
  mark.
- **A failure is reached, not cut to.** If the failing case is off screen
  the camera glides to it and the frog sets off as it gets there; if it is on
  screen the camera stays put. The light turns red as the caption arrives.
  The last picture stays under the result caption, and clear of it: a taller
  caption nudges the camera. A red light, like the caption's Replay, plays
  the failure again.
- **Each step has its view.** A step, and each callout it adds, glides the
  camera to the step's view, fitted so what it is about clears the panels,
  whether or not the learner moved the camera.

## Clarity

- **One component per idea.** Every label in the scene (tutorial callouts,
  failure labels, a frog's values) is the same tag: it rides with its frog,
  scales with distance, stays inside the window (the camera, not the tag,
  keeps it clear of the panels), eases sideways rather than jumping, and
  lifts above another label it would cover (a frog's values just hide).
  Don't invent a second kind.
- **Hierarchy you can read at a glance.** Primary actions are blue with a 3D
  edge (Check's is slimmer, with a spinner when it is slow); ordinary ones
  are white; secondary ones are quiet (a faint pill on panels, a grey glass
  pill over the scene). A secondary button must look secondary, and still be
  clearly visible. On cramped screens glass buttons may keep only their icon.
- **Quiet buttons keep their pill at rest**, so their edges line up with
  what's around them; bare text looks misaligned until hovered.
- **Consistent labels.** The same action has the same short label everywhere
  (e.g. always "Next"); change the caption, not the button. The exceptions
  say where the button goes ("Next: <title>", "Back to levels"). One icon
  per meaning, never two.
- **Captions are written, not dumped.** They use light Markdown (paragraphs,
  lists, bold, inline code coloured like the area box), name concrete values
  (`i = 1, n = 0`), and avoid italics. Long formulas wrap only after `&&` or
  `||`.
- **One moving thing at a time** while a caption explains something; motion
  that only decorates competes with the words.
- **Draw what doesn't exist faintly**, rather than not at all: states the
  precondition rules out are ghost tiles, still hoverable, and the readout
  says they are not possible states.
- **Hovering a tile answers Check's question.** The readout gives the tile's
  values, where it hops or that it stops, and whether it is on the area; a
  ghost frog shows the hop, on the same dashed line Check's ghost frogs draw.
- **Errors wait for Check.** A formula is never marked wrong while it is
  typed. Check (or Enter) on an invalid one shakes the box and underlines the
  fault, with the message inside the box, until the next edit.
- **Failures stay on the page.** No WebGL 2, a crash, or a solver that won't
  start is told in a plain card (with Reload) or a caption, never a blank
  page; the 3D title falls back to text.
- **Optical alignment matters.** Centre things on what the eye sees (a button
  with its 3D bottom edge, monospace digits that sit high, the visual centre
  of a row), and keep rings and outlines even on all sides.

## The tutorial

- **The caption comes first**, then the scene change it describes.
- **Next is always clickable** when shown. Pressed while a step is still
  playing, it skips ahead: the next step's scene is rebuilt at once. Nothing
  is queued and the learner never waits for an animation. Where the story
  waits for the learner (Check, a yes/no, a demo), there is no Next.
- **Back is always there** (after the first step) and at once rebuilds the
  last earlier step that showed something.
- **Only what the step asks for is enabled.** Step, Run, eggs and the formula
  box are locked otherwise, so the learner can't break the story.
- **A failure's caption stays** (with Replay) while the learner fixes the
  area; the ask is not repeated.
- **Hints add to the caption.** In the tutorial, Hint adds its sentence under
  the stage's ask and goes. In levels it stays: it shows "Hint 1 of 3", with
  "Another hint" and Close; pressed again later, it brings back the ones
  asked for.
- **Predict before you see**: a yes-or-no question comes before a pitfall's
  demo, unless the learner already saw that failure on their own area.
- **Spotlight** whatever the caption is talking about.
- A very fast double click must not press two buttons: a Next that has just
  appeared ignores clicks for 120 ms.

## Layout

- Desktop first; the 3D scene is full-screen and panels float over it.
- Narrow or tall windows stack the home copy under the scene; on small,
  squarish screens the copy fills the screen over a faint backdrop of the
  scene. A phone held sideways keeps the desktop home layout, smaller.
- Level panels shrink on narrow screens. On short landscape screens (a phone
  held sideways) the caption, area box and controls form a column on the
  right, so the scene keeps its height.
- The tile readout sits at the top centre, in the top bar's row when there is
  room; on phones it is a row of value chips above the caption.
- The code panel folds from its header (a Hide/Show pill) and resizes from a
  grip on its edge (double-click resets); its width is remembered per level.
  In the tutorial on phones it starts folded and opens when the story points
  at the code.
- Spacing, type and radii come from Tailwind's scales (plus a 15 px base text
  size, 14 px for captions and buttons on phones; the area box stays at
  16 px there so iOS doesn't zoom). Small deviations from a mock-up are fine
  for the sake of consistency.
