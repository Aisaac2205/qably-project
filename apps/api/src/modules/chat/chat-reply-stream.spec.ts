import { createReplyDeltaExtractor } from './chat-reply-stream';

function pushAll(chunks: string[]): string[] {
  const extractor = createReplyDeltaExtractor();
  return chunks.map((chunk) => extractor.push(chunk));
}

function decodeInChunksOf(json: string, size: number): string {
  const chunks: string[] = [];
  for (let index = 0; index < json.length; index += size) {
    chunks.push(json.slice(index, index + size));
  }
  return pushAll(chunks).join('');
}

describe('createReplyDeltaExtractor', () => {
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

  it('stops at the closing quote and ignores everything after it', () => {
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
