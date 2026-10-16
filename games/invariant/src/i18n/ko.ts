import type { Messages } from './en';

// Everything en.ts says, in Korean: written to read naturally in Korean, not
// translated line by line, so a sentence may say a little more or less than
// its English. Captions speak 합쇼체 (~습니다), with instructions as ~하세요
// and open questions as ~ㄹ까요?; button labels are short nouns.
//
// No italics: Korean doesn't use them for emphasis (the browser only slants
// the letters); bold or plain words carry it instead.
//
// Particles: a fixed name gets the one its reading takes (`i`가 — 아이,
// `n`이 — 엔). A formula or state filled in at run time is followed by a noun
// (조건, 칸…) or a particle that fits any word (에서, 의), never 이/가 or 을/를.

export const ko: Messages = {
  and: ', ',

  rules: {
    initialization: '초기화',
    maintenance: '유지',
    termination: '종료',
  },

  home: {
    tagline: '루프 불변식을 배우는 미니 게임',
    pitch: '내 루프가 어떤 입력에서도 맞게 동작한다고 어떻게 확신할 수 있을까요? 개구리들과 함께 알아봅시다.',
    tutorial: '튜토리얼',
    levels: '레벨',
    back: '뒤로',
    language: '언어',
    cleared: '클리어',
    clearedCount: (n, of) => `${of}개 레벨 중 ${n}개 클리어`,
    resetTitle: '클리어한 레벨 기록을 지웁니다',
    resetConfirm: '정말 초기화할까요?',
    soundOn: '소리 켜짐',
    soundOff: '소리 꺼짐',
  },

  topBar: {
    home: '홈',
    allLevels: '레벨 목록',
  },

  caption: {
    back: '이전',
    next: '다음',
    replay: '다시 보기',
    yes: '예',
    no: '아니요',
  },

  code: {
    title: '코드',
  },

  formula: {
    replay: '반례 다시 보기',
    area: '영역',
    placeholder: (names) => `${names}에 대한 조건`,
    check: '검사',
  },

  controls: {
    rules: '규칙',
    run: '실행',
    pause: '일시정지',
    step: '한 단계',
    reset: '리셋',
    resetTitle: '개구리를 모두 알로 되돌립니다 (영역은 그대로 남습니다)',
    hint: '힌트',
    hintTitle: '막혔을 때 도움을 줍니다',
    syntax: '문법',
    syntaxTitle: '영역 칸에 쓸 수 있는 식',
  },

  inputs: {
    title: '입력',
    decrease: (name) => `${name} 하나 줄이기`,
    increase: (name) => `${name} 하나 늘리기`,
    random: (name) => `${name} 무작위로 뽑기`,
    impossible: '있을 수 없는 입력',
  },

  hover: {
    impossible: '있을 수 없는 상태',
    hopsTo: (to) => `다음 칸 ${to}`,
    stopsOnGoal: '멈춤 · 목표 ✓',
    stops: '여기서 멈춤',
    inArea: '영역 안',
    outsideArea: '영역 밖',
  },

  rulesCard: {
    title: '세 가지 규칙',
    intro:
      '세 규칙을 모두 통과한 영역은 사후 조건을 증명할 수 있는 루프 불변식입니다. 어떤 입력이든, 멈추는 개구리는 반드시 목표에서 멈춘다는 뜻입니다.',
    initialization: '모든 알이 영역 위에 있습니다.',
    maintenance: '영역 위의 개구리는 뛰어도 다시 영역 위에 착지합니다.',
    termination: '영역 위에서 멈춘 개구리는 목표 위에 있습니다.',
    gotIt: '확인',
  },

  syntax: {
    title: '조건 쓰는 법',
    compare: '비교',
    combine: '조합',
    arithmetic: '산술',
    functions: '함수',
    arrays: '배열',
    constants: '상수',
    gotIt: '확인',
  },

  level: {
    hint: (k, of) => `**힌트 ${k}/${of}**`,
    anotherHint: '힌트 하나 더',
    undecided: '근처에서는 이 영역을 깨는 개구리를 찾지 못했습니다. 그렇다고 증명된 것도 아닙니다.',
    avoidDivision: ' 나눗셈을 빼 보세요. 예를 들어 `s == … / 2` 대신 `2 * s == …`처럼 써 보세요.',
    proved: '증명 성공! 영역 위 어느 개구리든, 어떤 입력이든 문제없습니다.',
    next: (title) => `다음: ${title}`,
    backToLevels: '레벨 목록으로',
    otherAnswers: (list) => `가능한 답으로는 ${list}도 있습니다.`,
  },

  verdicts: {
    solverFailed: (why) => `솔버를 시작하지 못했습니다: ${why}`,
    far: '근처는 모두 괜찮았지만, 멀리 떨어진 곳에 문제가 있습니다. ',
    yourArea: '영역',
    theArea: '이 영역',
    noLongerHolds: (part) => ` 여기서는 \`${part}\` 조건이 깨집니다.`,
    falseThere: (part) => ` 여기서는 \`${part}\` 조건이 거짓입니다.`,
    startsOutsideTag: (area) => `${area} 밖에서 출발`,
    startsOutside: (state, area) => `이 개구리는 ${state}에서 출발하는데, ${area} 밖입니다.`,
    landsOutsideTag: (area) => `${area} 밖에 착지`,
    landsOutside: (from, to, area) => `${from}에서 한 번 뛰면 ${to}에 착지하는데, ${area} 밖입니다.`,
    offGoalTag: '멈췄지만 목표가 아님',
    offGoal: (state) => `${state}에서 멈춘 개구리는 사후 조건을 만족하지 못합니다.`,
  },

  langErrors: {
    anArea: '영역',
    aCondition: '조건',
    bothBranches: '두 갈래',
    anIndex: '첨자',
    aBound: '범위의 끝',
    isArray: (name) => `${name}은(는) 배열입니다. \`${name}[0]\`처럼 칸 하나를 쓰세요`,
    notArray: (name) => `${name}은(는) 배열이 아니라 숫자입니다`,
    nameTaken: (name) => `'${name}'은(는) 이미 있는 이름입니다. 범위 변수에는 다른 이름을 쓰세요`,
    quantRange: (q) => `${q}에는 범위가 필요합니다. 예: \`${q} 0 <= k < n: …\``,
    quantName: '범위 가운데에 오는 이름이 범위 변수입니다. 예: `0 <= k < n`의 `k`',
    needsNumber: (text, ctx) => `${ctx}에는 숫자가 필요한데, \`${text}\` 부분은 참/거짓입니다`,
    needsCondition: (text, ctx) => `${ctx}에는 참/거짓 조건이 필요한데, \`${text}\` 부분은 숫자입니다`,
    didYouMean: (text, what) => `${what}에는 참/거짓 조건이 필요한데, \`${text}\` 부분은 숫자입니다. 혹시 \`${text} == 0\`을 쓰려고 했습니까?`,
    unknownName: (name, names) => `모르는 이름입니다: '${name}' (쓸 수 있는 이름: ${names})`,
    arity: (fn, n) => `${fn}에는 인자가 ${n}개 필요합니다`,
    positiveDivisor: (op) => `'${op}' 오른쪽에는 양수만 쓸 수 있습니다. 예: \`x ${op} 2\``,
    unexpectedChar: (c) => `쓸 수 없는 문자입니다: '${c}'`,
    expectedEnded: (text) => `'${text}' 없이 식이 끝났습니다`,
    expectedFound: (text, found) => `'${found}' 대신 '${text}' 기호가 와야 합니다`,
    expected: (text) => `'${text}' 기호가 필요합니다`,
    expectedNameEnded: '이름이 와야 하는데 식이 끝났습니다',
    expectedNameFound: (found) => `'${found}' 자리에는 이름이 와야 합니다`,
    notHere: (word) => `'${word}' 키워드는 여기에 쓸 수 없습니다`,
    unknownFunction: (name) => `모르는 함수입니다: '${name}' (쓸 수 있는 함수: abs, min, max)`,
    endsEarly: '식이 완성되지 않았습니다',
    unexpected: (found) => `'${found}' 부분을 이해하지 못했습니다`,
    empty: '조건을 입력하세요',
  },

  tutorial: {
    hint: '힌트:',
    undecided: '맞는지 틀리는지 증명하지 못했습니다. 더 간단한 식으로 써 보세요.',
    lostRule: (rule) => `방금 전까지 통과하던 ${rule} 규칙이 이번 수정으로 깨졌습니다. `,
    fixAndCheck: '영역을 고치고 다시 **검사**를 눌러 보세요.',
    trying: (f) => `\`${f}\` 조건으로 해 보겠습니다…`,
    guessedRight: '맞습니다! ',
    guessedWrong: '아쉽지만 틀렸습니다. ',
    predictedRight: '맞습니다! ',

    passedInitialization: '정답입니다! 모든 알이 영역 위에 있으므로 첫 번째 규칙을 통과했습니다.',
    passedMaintenance:
      '정답입니다! 어디서 뛰어도 영역을 벗어나지 않으므로 두 번째 규칙도 통과했습니다. 영역 위 어느 개구리든 뛰면 다시 영역에 착지합니다.',
    passedTermination: '정답입니다! 영역 위에서 멈추는 개구리는 모두 목표 위에 있으므로 세 번째 규칙도 통과했습니다.',
    whatIf: (pitfall, question) => `넘어가기 전에 하나만 생각해 봅시다. \`${pitfall}\` 조건이었다면 어땠을까요? ${question}`,
    objection:
      '“그래도 `i`는 `n`을 절대 넘지 않잖아요!” 하지만 영역은 그렇게 말하지 않습니다. 영역은 그 안의 어느 칸에든 개구리가 있을 수 있다고 주장하므로, 실제 개구리가 닿지 않는 칸까지 모두 검사합니다. 있을 수 없는 개구리까지 품지 않도록 영역을 **줄여** 보세요.',
    objectionDemo:
      '“그래도 `i`는 `n`을 절대 넘지 않잖아요!” 하지만 이 영역은 그렇게 말하지 않습니다. 영역은 그 안의 어느 칸에든 개구리가 있을 수 있다고 주장하므로, 실제 개구리가 닿지 않는 칸까지 모두 검사합니다. 고치려면 있을 수 없는 개구리를 빼도록 영역을 **줄여야** 합니다.',

    hello:
      '안녕하세요! 이 게임에서는 **루프 불변식**을 배웁니다. 루프 불변식이란 우리의 루프가 모든 입력에 대해 올바르게 동작한다는 것을 엄밀하게 증명하는 방법입니다.\n\n이 튜토리얼에서는 직접 불변식을 써 보면서 루프가 올바르다는 것을 증명할 겁니다. 먼저 게임의 무대부터 살펴보겠습니다.',
    letsGo: '시작하기',
    frog: '개구리 한 마리는 어떤 입력으로 실행한 프로그램입니다. 개구리가 앉은 칸은 지금 변수들의 값, 즉 **프로그램 상태**를 나타냅니다: `i = 0, n = 3`.\n\n평면의 축이 각 변수에 대응하고, 개구리의 위치가 곧 변수들의 값입니다.',
    program: '이것은 프로그램의 **코드**입니다. 루프는 `i < n`인 동안 본문을 계속 반복합니다.',
    contracts:
      '처음 보는 줄이 두 개 있습니다.\n\n- `requires`는 **사전 조건**입니다. 입력에 대해 미리 가정하는 것으로, 여기서는 `n`이 음수가 아니라고 가정합니다.\n- `ensures`는 **사후 조건**입니다. 루프가 끝났을 때 반드시 성립해야 하는 것으로, 여기서는 `i`가 `n`에 도달해 있어야 합니다.',
    pressStep: '**한 단계**를 눌러서 루프 본문을 한 번 실행해 보세요.',
    keepStepping: '한 번 뛰는 것이 루프 본문을 한 번 실행하는 것입니다. `i`가 `0`에서 `1`이 되었습니다.\n\n개구리가 멈출 때까지 **한 단계**를 계속 눌러 보세요.',
    stops:
      '이제 `i < n`이 거짓이므로(`3 < 3`) 루프가 끝나고, 개구리도 **멈춥니다**.\n\n- 빗금 친 칸은 루프가 멈추는 곳입니다.\n- 칸에 마우스를 올리거나 칸을 누르면 거기 있는 개구리가 어디로 뛸지 미리 볼 수 있습니다.',
    stopsTag: '멈춤: 3 < 3은 거짓',
    eggs: '개구리는 어디서 출발할까요? 프로그램은 `i`를 `0`으로 정하고, 사전 조건에 따라 `n`은 `0` 이상의 어떤 수든 될 수 있습니다.\n\n**알** 하나하나가 시작 상태, 즉 실제 개구리가 출발하는 곳입니다.',
    eggsTag: '시작 상태: i = 0, n = 2',
    goals:
      '주황색 원이 있는 칸은 **목표**입니다. 사후 조건 `i == n`이 성립하는 칸입니다.\n\n아까 움직여 본 개구리도 `i = 3, n = 3`에 있는 목표에서 멈췄습니다.',
    goalsTag: '목표에서 멈춤',
    bug: '멈추는 칸이 전부 목표인 것은 아닙니다. 만약 개구리가 여기 `i = 3, n = 1`에서 멈춘다면, `i ≠ n`인 채로 루프가 끝납니다. 프로그램이 틀렸다는 뜻입니다.\n\n프로그램이 맞으려면 **모든 개구리가 목표에서 멈춰야** 합니다.',
    bugTag: '멈췄지만 i ≠ n',
    pressRun: '과연 모든 개구리가 목표에서 멈출까요? 직접 확인해 봅시다. **실행**을 누르면 앞쪽 알 10개가 부화해서 한꺼번에 움직입니다.',
    allTen: '10마리 모두 목표에서 멈췄습니다. `n`이 0 이상 9 이하일 때는 프로그램이 올바르다는 뜻입니다.',
    endless:
      '하지만 겨우 입력 10개를 확인했을 뿐입니다. `n`은 어떤 수든 될 수 있어서 알은 끝없이 이어집니다. 아무리 많이 확인해도 남은 알은 무한히 많습니다.\n\n알을 몇 개 더 눌러서 실행해 보세요. 모두 잘 동작합니다. 그래도 하나하나 확인해서는 끝이 없습니다. **그렇다면 모든 알에 대해서 프로그램이 올바르다는 것은 어떻게 확신할 수 있을까요?**',
    testedTag: '확인함: n = 0 ~ 9',
    endlessTag: 'n = 18, 19, … 끝없음',
    invariant:
      '모든 입력에 대해 증명하려면, 프로그램이 루프 맨 위에 올 때마다 항상 참인 조건이 필요합니다.\n\n이런 조건을 **루프 불변식**이라고 합니다. 이 세계에서는 루프 불변식이 평면 위의 **영역**으로 나타납니다. 영역은 세 가지 검사를 통과해야 하는데, 하나씩 살펴보겠습니다.',
    draw: '`i`와 `n`으로 아무 조건이나 써 보세요. 조건이 참인 칸들이 **블록**으로 솟아오릅니다.\n\n`i == 2`, `i % 2 == 0`, `i < n` 같은 식을 써 보세요. 쓸 수 있는 식은 입력 칸 아래 **문법**에서 볼 수 있습니다.',

    askInitialization:
      '첫 번째 규칙: 모든 알이 영역 위에 있어야 합니다. 첫 점프를 하기 전부터 조건이 참이어야 하기 때문입니다.\n\n모든 알을 덮는 영역을 쓰고 **검사**를 눌러 보세요.',
    nudgeInitialization: '알은 모두 `i` 값이 같습니다. 얼마일까요?',
    questionInitialization: '알이 모두 그 위에 있을까요?',
    afterDemoInitialization: (mine) =>
      `**규칙 1 · 초기화**: 모든 알이 영역 위에 있어야 합니다. \`i == n\`은 \`n = 0\`인 알 하나만 덮지만, 지금 쓴 ${mine} 조건은 전부 덮습니다.`,
    afterOwnInitialization: (mine) =>
      `**규칙 1 · 초기화**: 모든 알이 영역 위에 있어야 합니다. 처음에는 놓친 알이 있었지만, 지금 쓴 ${mine} 조건은 전부 덮습니다.`,

    askMaintenance:
      '이번에는 점프입니다. 영역 위의 개구리는 뛸 때마다 다시 영역 위에 착지해야 합니다.\n\n알은 계속 영역 위에 두면서, 어떤 점프도 영역 밖으로 나가지 않게 해 보세요. 이제 **검사**는 규칙 1과 2를 함께 확인합니다.',
    nudgeMaintenance: '개구리는 모두 `i = 0`에서 출발하고, 뛸 때마다 `i`는 늘어나기만 합니다.',
    explainMaintenance:
      '반투명한 개구리는 **유령 개구리**입니다. 실제 개구리가 아니라, 영역을 검사하려고 영역 위 칸에 놓은 개구리입니다. 영역이 그곳에도 개구리가 있을 수 있다고 했기 때문입니다.',
    questionMaintenance: '거기서 뛰면 항상 다시 그 위에 착지할까요?',
    afterDemoMaintenance:
      '**규칙 2 · 유지**: 영역 위의 개구리는 뛰어도 영역 위에 착지해야 합니다. 개구리는 중간 칸들도 지나가기 때문입니다!\n\n**유령 개구리**는 실제 개구리가 닿는 칸뿐 아니라 영역의 어느 칸에서든 출발할 수 있습니다. 영역은 개구리가 있을 수 있는 곳에 대한 주장이고, **검사**는 그 주장 전체를 확인합니다.',
    afterOwnMaintenance:
      '**규칙 2 · 유지**: 영역 위의 개구리는 뛰어도 영역 위에 착지해야 합니다.\n\n**유령 개구리**는 실제 개구리가 닿는 칸뿐 아니라 영역의 어느 칸에서든 출발할 수 있습니다. 영역은 개구리가 있을 수 있는 곳에 대한 주장이고, **검사**는 그 주장 전체를 확인합니다.',
    extraMaintenance: '반투명한 개구리는 **유령 개구리**입니다. 실제 개구리가 아니라, 영역을 검사하려고 영역 위 칸에 놓은 개구리입니다.',

    followOne: '두 규칙을 모두 통과했습니다. 이것이 무슨 뜻인지 개구리 한 마리를 따라가 봅시다.',
    startsOn: '개구리는 영역 위에서 출발합니다. 이것이 **초기화**입니다.',
    startsOnTag: '초기화',
    everyHop: '뛸 때마다 다시 영역 위에 착지합니다. 이것이 **유지**입니다.',
    stillOnTag: '아직 영역 위',
    neverLeaves:
      '따라서 몇 번을 뛰든 개구리는 영역을 벗어날 수 없습니다. 그래서 이 영역은 **불변식**입니다. 프로그램이 루프 맨 위에 올 때마다 항상 참이기 때문입니다.\n\n루프가 멈출 때도 개구리는 영역 어딘가에 있습니다. 하지만 우리가 보여야 하는 것은 개구리가 **목표**에서 멈춘다는 것입니다. 영역 위에서 멈추면 반드시 목표 위일까요?',

    stopsAllGoals:
      '이 영역에서는 그렇습니다. 테두리로 표시한 칸들을 보세요. 영역 위에 있으면서 루프가 멈추는 칸, 즉 개구리가 멈출 수 있는 곳인데, 모두 목표입니다.\n\n이것이 세 번째 규칙입니다. 영역 위에서 멈추는 개구리는 모두 목표 위에 있어야 합니다.',
    onlyIfGoal:
      '이 영역에서는 아닙니다. 테두리로 표시한 칸들을 보세요. 영역 위에 있으면서 루프가 멈추는 칸, 즉 개구리가 멈출 수 있는 곳입니다. 빨간 칸은 목표가 아닙니다.\n\n세 번째 규칙은 이 칸들이 모두 목표여야 한다는 것입니다.',
    confirmTermination: '**검사**를 눌러 확인해 보세요. 이제 세 규칙을 모두 확인합니다.',
    askTermination: '멈추는 개구리가 모두 목표 위에 있도록 영역을 고친 뒤 **검사**를 눌러 보세요. 이제 세 규칙을 모두 확인합니다.',
    nudgeTermination: '실제 개구리는 `n`을 넘지 않습니다. 그러므로 `i`는 `n`보다 클 수 없습니다.',
    questionTermination: '세 규칙을 모두 통과할까요?',
    afterDemoTermination:
      '**규칙 3 · 종료**: 영역 위에서 멈춘 개구리는 목표 위에 있어야 합니다. `i >= 0`은 모든 실제 개구리에게 성립하는 참인 불변식이지만, 목표를 증명하기에는 너무 약합니다.',
    afterOwnTermination: (mine) =>
      `**규칙 3 · 종료**: 영역 위에서 멈춘 개구리는 목표 위에 있어야 합니다. 앞의 영역도 참인 불변식이었지만 목표를 증명하기에는 너무 약했습니다. 지금 쓴 ${mine} 조건은 충분히 강합니다.`,

    twoWays:
      '루프 불변식이 틀릴 수 있는 방법은 두 가지가 있습니다.\n\n- 영역이 너무 **작으면** 알이나 점프가 영역 밖으로 빠져서, 초기화나 유지에서 걸립니다.\n- 너무 **크면** 목표가 아닌 곳에서 멈추는 개구리까지 품게 되어, 종료에서 걸립니다.\n\n불변식은 그 사이 어딘가에 있습니다. 영역을 줄이는 것을 불변식을 **강화**한다고 합니다.',
    tooSmallTag: '너무 작음: 알이 밖에 있음',
    tooLargeTag: '너무 큼: 목표 밖에서 멈춤',

    wrapUp: (mine) =>
      `지금 쓴 ${mine} 조건은 세 규칙을 모두 통과합니다.\n\n- **초기화:** 모든 알이 그 위에 있습니다.\n- **유지:** 어떻게 뛰어도 밖으로 나가지 않습니다.\n- **종료:** 그 위에서 멈추는 개구리는 모두 목표에 있습니다.\n\n사후 조건을 증명할 만큼 강한 루프 불변식입니다. 개구리를 하나도 실행해 보지 않고도, 모든 \`n\`에 대해 멈추는 개구리는 반드시 목표에서 멈춘다는 것을 보였습니다.`,
    finish: '마치기',
  },
};
