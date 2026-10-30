import { createReplyDeltaExtractor } from './chat-reply-stream';

function pushAll(chunks: string[]): string[] {
  const extractor = createReplyDeltaExtractor();
  return chunks.map((chunk) => extractor.push(chunk).replyDelta);
}

function pushAllCases(chunks: string[]): string[][] {
  const extractor = createReplyDeltaExtractor();
  return chunks.map((chunk) =>
    extractor.push(chunk).cases.map((entry) => entry.case.title),
  );
}

function decodeInChunksOf(json: string, size: number): string {
  const chunks: string[] = [];
  for (let index = 0; index < json.length; index += size) {
    chunks.push(json.slice(index, index + size));
  }
  return pushAll(chunks).join('');
}

const VALID_CASE = {
  title: 'Rejects an expired card',
  objective: 'Confirm expired cards are refused',
  steps: ['Open checkout', 'Enter an expired card'],
  expectedResult: 'The payment is refused',
  priority: 'high',
};

describe('createReplyDeltaExtractor — reply text', () => {
  it('emits the reply text as it arrives, chunk by chunk', () => {
    expect(
      pushAll(['{"reply":"Hel', 'lo, ', 'world', '","cases":[]}']),
    ).toEqual(['Hel', 'lo, ', 'world', '']);
  });

  it('emits nothing until the reply value has started', () => {
    expect(pushAll(['{"re', 'ply"', ' : ', '"', 'Hi"}'])).toEqual([
      '',
      '',
      '',
      '',
      'Hi',
    ]);
  });

  it('decodes every JSON string escape', () => {
    const reply = 'a"b\\c/d\be\ff\ng\rh\tié';
    const json = JSON.stringify({ reply, cases: [] }).replace('/', '\\/');

    expect(pushAll([json]).join('')).toBe(reply);
  });

  it('never emits a partial escape when a backslash ends a chunk', () => {
    expect(pushAll(['{"reply":"line\\', 'nnext"}'])).toEqual([
      'line',
      '\nnext',
    ]);
  });

  it('decodes a \\u escape split across chunks', () => {
    expect(pushAll(['{"reply":"caf\\u0', '0', 'e9!"}'])).toEqual([
      'caf',
      '',
      'é!',
    ]);
  });

  it('holds a high surrogate until its low surrogate arrives in a later chunk', () => {
    expect(pushAll(['{"reply":"ok \\ud83d', '\\ude00 done"}'])).toEqual([
      'ok ',
      '😀 done',
    ]);
  });

  it('holds a raw high surrogate that ends a chunk', () => {
    const smile = '😀';

    expect(pushAll(['{"reply":"a' + smile[0], smile[1] + 'b"}']).join('')).toBe(
      'a😀b',
    );
    expect(pushAll(['{"reply":"a' + smile[0], smile[1] + 'b"}'])[0]).toBe('a');
  });

  it('finds the top-level reply key when it is not the first key, ignoring nested reply keys and reply values', () => {
    const json = JSON.stringify({
      cases: [{ title: 'reply', reply: 'nested, not the answer' }],
      grounding: { status: 'insufficient', note: 'reply' },
      reply: 'The real answer',
    });

    expect(decodeInChunksOf(json, 3)).toBe('The real answer');
  });

  it('ignores braces and quotes inside earlier string values', () => {
    const json = JSON.stringify({
      cases: [{ title: '{"reply":"fake"} [', objective: 'x\\"y' }],
      reply: 'Real',
    });

    expect(decodeInChunksOf(json, 1)).toBe('Real');
  });

  it('emits no further reply text once the reply string closes, even once cases follow', () => {
    expect(
      pushAll(['{"reply":"Done"', ',"cases":[{"title":"more \\"text\\""}]}']),
    ).toEqual(['Done', '']);
  });

  it('decodes the same text whatever the chunk size', () => {
    const reply = 'Línea 1\n"quoted" \\ tab\t emoji 😀 end';
    const json = JSON.stringify({ reply, cases: [], grounding: {} });

    for (const size of [1, 2, 3, 5, 7, 64]) {
      expect(decodeInChunksOf(json, size)).toBe(reply);
    }
  });

  it('emits nothing when the reply value is not a string', () => {
    expect(pushAll(['{"reply":null,"cases":[]}', '"x"'])).toEqual(['', '']);
  });
});

describe('createReplyDeltaExtractor — cases', () => {
  it('emits a case once its closing brace completes, even split across chunks', () => {
    const json = JSON.stringify({ reply: 'ok', cases: [VALID_CASE] });
    const extractor = createReplyDeltaExtractor();
    const emitted: ReturnType<typeof extractor.push>['cases'] = [];
    for (let i = 0; i < json.length; i += 7) {
      emitted.push(...extractor.push(json.slice(i, i + 7)).cases);
    }

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({
      index: 0,
      case: { ...VALID_CASE, preconditions: [] },
    });
  });

  it('emits multiple cases in order, each once its own element closes, with sequential indexes', () => {
    const second = { ...VALID_CASE, title: 'Accepts a valid card' };
    const json = JSON.stringify({
      reply: 'ok',
      cases: [VALID_CASE, second],
    });
    const extractor = createReplyDeltaExtractor();
    const emitted: Array<{ index: number; title: string }> = [];
    for (let i = 0; i < json.length; i += 5) {
      for (const entry of extractor.push(json.slice(i, i + 5)).cases) {
        emitted.push({ index: entry.index, title: entry.case.title });
      }
    }

    expect(emitted).toEqual([
      { index: 0, title: VALID_CASE.title },
      { index: 1, title: 'Accepts a valid card' },
    ]);
  });

  it('drops a case object that fails suggestedCaseSchema validation, emitting nothing for it', () => {
    const json = JSON.stringify({
      reply: 'ok',
      cases: [{ title: 'missing required fields' }],
    });

    expect(pushAllCases([json])).toEqual([[]]);
  });

  it('emits no case events for an empty cases array', () => {
    expect(pushAllCases(['{"reply":"ok","cases":[]}'])).toEqual([[]]);
  });

  it('extracts cases that come before the reply in the envelope', () => {
    const json = JSON.stringify({ cases: [VALID_CASE], reply: 'ok' });

    expect(pushAllCases([json])).toEqual([[VALID_CASE.title]]);
  });

  it('never breaks when a case field contains braces, brackets and escaped quotes', () => {
    const tricky = {
      ...VALID_CASE,
      title: 'Handles {"weird"} [input] like "this"',
      steps: ['Open the {panel}', 'Type \\"quoted\\" text'],
    };
    const json = JSON.stringify({ reply: 'ok', cases: [tricky] });

    expect(pushAllCases([json])).toEqual([[tricky.title]]);
  });

  it('extracts the same cases whatever the chunk size', () => {
    const second = { ...VALID_CASE, title: 'Accepts a valid card' };
    const json = JSON.stringify({ reply: 'ok', cases: [VALID_CASE, second] });

    for (const size of [1, 2, 3, 5, 7, 64]) {
      const extractor = createReplyDeltaExtractor();
      const emitted: string[] = [];
      for (let i = 0; i < json.length; i += size) {
        for (const entry of extractor.push(json.slice(i, i + size)).cases) {
          emitted.push(entry.case.title);
        }
      }
      expect(emitted).toEqual([VALID_CASE.title, second.title]);
    }
  });
});
