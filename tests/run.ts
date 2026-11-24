import assert from 'node:assert/strict';
import { parseYouTubeUrl } from '../src/lib/youtube';
import { parseTime, formatPrecise, validateRange, nearestRate } from '../src/lib/time';
import { BaseMediaController } from '../src/services/media/MediaController';
import { LoopEngine, buildRateSteps, rateForRepetition } from '../src/services/practice/LoopEngine';
import { buildExport, mergeLibraries, parseImport } from '../src/services/storage/importExport';
import { addTap, bpmFromTaps, clampBpm, detectBpm, onsetEnvelope, ENVELOPE_FPS } from '../src/lib/tempo';
import { DEFAULT_PRACTICE, type Library, type Track, type Clip } from '../src/types';

let passed = 0;
const test = async (name: string, fn: () => void | Promise<void>) => {
  try { await fn(); passed++; console.log('  ok  ', name); }
  catch (e) { console.error('  FAIL', name, '\n', e); process.exitCode = 1; }
};

// ---------- YouTube ----------
const ID = 'dQw4w9WgXcQ';
await test('links do YouTube em vários formatos', () => {
  const urls = [
    `https://www.youtube.com/watch?v=${ID}`, `http://youtube.com/watch?v=${ID}&list=PL123&index=2`, `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`, `https://youtu.be/${ID}`, `https://youtu.be/${ID}?si=abc`, `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`, `https://www.youtube.com/live/${ID}?feature=share`, `youtube.com/watch?v=${ID}`, ` ${ID} `,
    `https://www.youtube-nocookie.com/embed/${ID}`,
  ];
  for (const u of urls) { const r = parseYouTubeUrl(u); assert.ok(r.ok, u); assert.equal(r.ok && r.value.id, ID, u); }
});
await test('tempo inicial no link', () => {
  const r = parseYouTubeUrl(`https://youtu.be/${ID}?t=90`); assert.ok(r.ok && r.value.start === 90);
  const r2 = parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&t=1m30s`); assert.ok(r2.ok && r2.value.start === 90);
});
await test('links inválidos', () => {
  for (const u of ['', 'banana', 'https://vimeo.com/123', 'https://www.youtube.com/playlist?list=PL1', 'https://www.youtube.com/watch?v=curto', 'https://youtu.be/']) assert.equal(parseYouTubeUrl(u).ok, false, u);
});

// ---------- Tempo ----------
await test('parseTime / formatPrecise / validateRange', () => {
  assert.equal(parseTime('1:23.5'), 83.5); assert.equal(parseTime('83,5'), 83.5); assert.equal(parseTime('1:02:03'), 3723);
  assert.equal(parseTime('abc'), null); assert.equal(parseTime('1.5:20'), null); assert.equal(parseTime(''), null);
  assert.equal(formatPrecise(83.456), '1:23.46'); assert.equal(formatPrecise(5), '0:05.00');
  assert.equal(validateRange(10, 5, 100).ok, false); assert.equal(validateRange(10, 10.1, 100).ok, false);
  assert.equal(validateRange(10, 20, 100).ok, true); assert.equal(validateRange(10, 120, 100).ok, false); assert.equal(validateRange(null, 5, 100).ok, true);
  assert.equal(nearestRate(0.77, [0.5, 0.75, 1]), 0.75);
});

// ---------- Motor de loop ----------
class Fake extends BaseMediaController {
  readonly kind = 'local' as const; readonly loopLookahead = 0.05;
  t = 0; seeks: number[] = []; rates: number[] = [];
  constructor() { super(); this.state = { ...this.state, status: 'playing', duration: 100, availableRates: [0.5, 0.75, 1, 1.25, 1.5] }; }
  getCurrentTime() { return this.t; }
  play() { this.patch({ status: 'playing' }); } pause() { this.patch({ status: 'paused' }); }
  seek(t: number) { this.t = t; this.seeks.push(t); this.emitTime(t); }
  setRate(r: number) { this.rates.push(r); this.patch({ rate: r }); }
  setVolume() {} setMuted() {}
  advance(to: number) { this.t = to; this.emitTime(to); }
  /** simula reprodução em passos de 0,02 s */
  run(to: number) { const n = this.seeks.length; while (this.t < to - 1e-9 && this.seeks.length === n) this.advance(Math.min(this.t + 0.02, to)); }
}

await test('loop simples volta para A ao chegar em B', () => {
  const c = new Fake(); const e = new LoopEngine(c); e.setRange(10, 20); e.setLoopEnabled(true);
  c.t = 9; c.run(20.1);
  assert.deepEqual(c.seeks, [10]); assert.ok(c.t >= 10 && c.t < 11, String(c.t));
  c.run(20.1); assert.equal(c.seeks.length, 2);
});
await test('loop desligado ou pausado não salta', () => {
  const c = new Fake(); const e = new LoopEngine(c); e.setRange(10, 20);
  c.t = 9; c.run(25); assert.equal(c.seeks.length, 0);
  e.setLoopEnabled(true); c.pause(); c.advance(19.99); assert.equal(c.seeks.length, 0);
});
await test('não conta repetição duas vezes quando a fonte demora a refletir o seek (latência)', () => {
  const c = new Fake(); const e = new LoopEngine(c);
  c.seek = (t: number) => { c.seeks.push(t); /* tempo NÃO muda de imediato */ };
  e.setRange(10, 20); c.t = 19; c.run(19.96);
  e.startSession({ ...DEFAULT_PRACTICE, repetitions: 5 }); c.seeks.length = 0;
  c.advance(19.9); c.advance(19.96); c.advance(19.97); c.advance(19.98); c.advance(19.99);
  assert.equal(e.getSnapshot().completed, 1, 'contou uma única repetição'); assert.equal(c.seeks.length, 1);
});
await test('sessão com 3 repetições termina sozinha e pausa em A', () => {
  const c = new Fake(); const e = new LoopEngine(c); e.setRange(10, 12);
  assert.equal(e.startSession({ ...DEFAULT_PRACTICE, repetitions: 3 }), true);
  assert.equal(e.getSnapshot().phase, 'running');
  for (let i = 0; i < 3; i++) c.run(12.1);
  const s = e.getSnapshot(); assert.equal(s.phase, 'finished'); assert.equal(s.completed, 3); assert.equal(c.getState().status, 'paused'); assert.equal(c.t, 10);
});
await test('sessão infinita só termina ao interromper (e restaura velocidade)', () => {
  const c = new Fake(); const e = new LoopEngine(c); e.setRange(10, 12);
  e.startSession({ ...DEFAULT_PRACTICE, repetitions: 0, progressive: true, startRate: 0.5, targetRate: 1, repsPerStep: 1 });
  for (let i = 0; i < 20; i++) c.run(12.1);
  assert.equal(e.getSnapshot().phase, 'running'); assert.equal(e.getSnapshot().completed, 20);
  assert.equal(e.getSnapshot().currentRate, 1);
  e.stopSession(); assert.equal(e.getSnapshot().phase, 'idle'); assert.equal(c.getState().rate, 1);
});
await test('velocidade progressiva usa só velocidades suportadas e sobe a cada degrau', () => {
  const steps = buildRateSteps(0.5, 1.25, [0.5, 0.75, 1, 1.25, 1.5]); assert.deepEqual(steps, [0.5, 0.75, 1, 1.25]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 99].map((i) => rateForRepetition(steps, i, 2)), [0.5, 0.5, 0.75, 0.75, 1, 1, 1.25, 1.25, 1.25]);
  const c = new Fake(); const e = new LoopEngine(c); e.setRange(10, 12);
  e.startSession({ ...DEFAULT_PRACTICE, repetitions: 4, progressive: true, startRate: 0.5, targetRate: 1, repsPerStep: 1 });
  const seen = [e.getSnapshot().currentRate]; for (let i = 0; i < 3; i++) { c.run(12.1); seen.push(e.getSnapshot().currentRate); }
  assert.deepEqual(seen, [0.5, 0.75, 1, 1]);
  assert.ok(c.rates.every((r) => [0.5, 0.75, 1, 1.25, 1.5].includes(r)));
});
await test('pausa entre repetições e retomada', async () => {
  const c = new Fake(); const e = new LoopEngine(c); e.setRange(10, 12);
  e.startSession({ ...DEFAULT_PRACTICE, repetitions: 2, gap: 0.3 });
  c.run(12.1); assert.equal(e.getSnapshot().phase, 'gap'); assert.equal(c.getState().status, 'paused');
  await new Promise((r) => setTimeout(r, 450));
  assert.equal(e.getSnapshot().phase, 'running'); assert.equal(c.getState().status, 'playing');
  c.run(12.1); assert.equal(e.getSnapshot().phase, 'finished');
});
await test('interromper durante a pausa cancela tudo', async () => {
  const c = new Fake(); const e = new LoopEngine(c); e.setRange(10, 12);
  e.startSession({ ...DEFAULT_PRACTICE, repetitions: 5, gap: 1 }); c.run(12.1);
  e.stopSession(); await new Promise((r) => setTimeout(r, 1200));
  assert.equal(e.getSnapshot().phase, 'idle'); assert.equal(c.getState().status, 'paused');
});
await test('sessão exige A e B válidos', () => {
  const c = new Fake(); const e = new LoopEngine(c); e.setRange(10, null); assert.equal(e.startSession(DEFAULT_PRACTICE), false); e.setRange(10, 10.05); assert.equal(e.startSession(DEFAULT_PRACTICE), false);
});
await test('se o usuário pula muito além de B, volta a A sem contar repetição', () => {
  const c = new Fake(); const e = new LoopEngine(c); e.setRange(10, 12);
  e.startSession({ ...DEFAULT_PRACTICE, repetitions: 5 }); c.run(10.5); c.advance(60);
  assert.equal(e.getSnapshot().completed, 0); assert.equal(c.t, 10);
});


await test('contagem 1-2-3 antes do ensaio e a cada volta', async () => {
  const c = new Fake(); const beats: string[] = []; const e = new LoopEngine(c, (b, t) => beats.push(`${b}/${t}`)); e.setRange(10, 12);
  e.startSession({ ...DEFAULT_PRACTICE, repetitions: 2, countIn: 3, countEach: true });
  assert.equal(e.getSnapshot().phase, 'countin'); assert.equal(c.getState().status, 'paused'); assert.deepEqual(beats, ['1/3']);
  await new Promise((r) => setTimeout(r, 3200));
  assert.deepEqual(beats, ['1/3', '2/3', '3/3']); assert.equal(e.getSnapshot().phase, 'running'); assert.equal(c.getState().status, 'playing');
  c.run(12.1); assert.equal(e.getSnapshot().phase, 'countin', 'nova contagem na volta'); assert.equal(e.getSnapshot().completed, 1);
  e.stopSession(); assert.equal(e.getSnapshot().phase, 'idle');
});
await test('contagem ao dar play com loop ligado (sem sessão) e cancelamento', async () => {
  const c = new Fake(); const beats: number[] = []; const e = new LoopEngine(c, (b) => beats.push(b)); e.setRange(10, 12); e.setLoopEnabled(true);
  e.setConfig({ ...DEFAULT_PRACTICE, countIn: 2 });
  assert.equal(e.playWithCountIn(), true); assert.equal(e.getSnapshot().session, false); assert.equal(e.getSnapshot().phase, 'countin');
  await new Promise((r) => setTimeout(r, 2200)); assert.deepEqual(beats, [1, 2]); assert.equal(e.getSnapshot().phase, 'idle'); assert.equal(c.getState().status, 'playing');
  c.pause(); e.setConfig({ ...DEFAULT_PRACTICE, countIn: 0 }); assert.equal(e.playWithCountIn(), false);
  e.setConfig({ ...DEFAULT_PRACTICE, countIn: 3 }); e.playWithCountIn(); e.stopSession(); await new Promise((r) => setTimeout(r, 3300));
  assert.equal(c.getState().status, 'paused', 'cancelada: não toca depois');
});

await test('loop simples com contagem a cada volta: conta de novo ao voltar para A', async () => {
  const c = new Fake(); const beats: number[] = []; const e = new LoopEngine(c, (b) => beats.push(b)); e.setRange(10, 12); e.setLoopEnabled(true);
  e.setConfig({ ...DEFAULT_PRACTICE, countIn: 2, countEach: true, bpm: 240 });
  c.t = 11; c.run(12.1);
  assert.equal(e.getSnapshot().phase, 'countin', 'contagem começa na volta'); assert.equal(c.getState().status, 'paused'); assert.equal(c.t, 10); assert.deepEqual(beats, [1]);
  await new Promise((r) => setTimeout(r, 600));
  assert.deepEqual(beats, [1, 2]); assert.equal(e.getSnapshot().phase, 'idle'); assert.equal(c.getState().status, 'playing');
  e.setConfig({ ...DEFAULT_PRACTICE, countIn: 2, countEach: false }); beats.length = 0;
  c.run(12.1); assert.deepEqual(beats, [], 'sem repetir a contagem, só volta'); assert.equal(c.getState().status, 'playing');
});
await test('ritmo da contagem segue o BPM e a velocidade', async () => {
  const c = new Fake(); const stamps: number[] = []; const e = new LoopEngine(c, () => stamps.push(Date.now())); e.setRange(10, 12); e.setLoopEnabled(true);
  c.setRate(0.5); e.setConfig({ ...DEFAULT_PRACTICE, countIn: 3, bpm: 240 }); // 240 × 0,5 = 120 BPM → 500 ms
  e.playWithCountIn(); await new Promise((r) => setTimeout(r, 1300));
  const gaps = stamps.slice(1).map((t, i) => t - stamps[i]);
  assert.equal(gaps.length, 2); for (const g of gaps) assert.ok(g > 420 && g < 620, String(g));
  e.stopSession();
});
await test('tocar no ritmo: mediana dos toques e recomeço após pausa', () => {
  let taps: number[] = [];
  for (const t of [0, 500, 1000]) taps = addTap(taps, t);
  assert.equal(Math.round(bpmFromTaps(taps) as number), 120);
  taps = addTap(taps, 1510); taps = addTap(taps, 1990); taps = addTap(taps, 2900 /* toque atrasado */); taps = addTap(taps, 3400);
  assert.equal(clampBpm(bpmFromTaps(taps) as number), 120, 'um toque fora do tempo não estraga a medida');
  taps = addTap(taps, 9000); assert.deepEqual(taps, [9000]); assert.equal(bpmFromTaps(taps), null);
  assert.equal(clampBpm(5), 30); assert.equal(clampBpm(999), 300);
});
await test('detecção automática do andamento em áudio sintético', () => {
  const sr = 8000;
  const make = (bpm: number, seconds: number) => {
    const data = new Float32Array(sr * seconds); const period = (60 / bpm) * sr;
    for (let k = 0; k * period < data.length; k++) {
      const s0 = Math.round(k * period); const amp = k % 4 === 0 ? 1 : 0.6;
      for (let j = 0; j < 400 && s0 + j < data.length; j++) data[s0 + j] = amp * Math.sin(j * 0.9) * Math.exp(-j / 80);
    }
    for (let i = 0; i < data.length; i++) data[i] += (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.01;
    return data;
  };
  for (const bpm of [72, 96, 120, 150]) {
    const env = onsetEnvelope([make(bpm, 20)], sr); assert.equal(env.length, 20 * ENVELOPE_FPS);
    const found = detectBpm(env); assert.ok(found !== null && Math.abs(found - bpm) <= 2, `${bpm} → ${found}`);
  }
  const env = onsetEnvelope([make(100, 30)], sr); const found = detectBpm(env, ENVELOPE_FPS, 8, 20);
  assert.ok(found !== null && Math.abs(found - 100) <= 2, `trecho A–B: ${found}`);
  assert.equal(detectBpm(env, ENVELOPE_FPS, 8, 10), null, 'trecho curto demais');
  assert.equal(detectBpm(onsetEnvelope([new Float32Array(sr * 10)], sr)), null, 'silêncio');
});

// ---------- Importação / exportação ----------
const mkTrack = (id: string, over: Partial<Track> = {}): Track => ({
  id, title: 'Música ' + id, source: 'youtube', youtubeId: 'abcdefghi' + id.padStart(2, '0'), youtubeUrl: '', favorite: false, categoryId: null,
  practice: { ...DEFAULT_PRACTICE }, session: { position: 0, a: null, b: null, loopEnabled: false, rate: 1, activeClipId: null }, createdAt: 1, updatedAt: 1, ...over,
});
const mkClip = (id: string, trackId: string, start: number, end: number, name = 'Refrão'): Clip => ({ id, trackId, name, start, end, rate: 0.75, repetitions: 4, gap: 1, order: 0 });
const lib: Library = {
  tracks: [mkTrack('1'), mkTrack('2', { source: 'local', youtubeId: undefined, local: { name: 'a.mp3', size: 1000, mimeType: 'audio/mpeg', isVideo: false, stored: true } })],
  clips: [mkClip('c1', '1', 10, 20), mkClip('c2', '2', 5, 8, 'Solo')],
  categories: [{ id: 'k1', name: 'Louvor' }], setlists: [{ id: 's1', name: 'Domingo', trackIds: ['1', '2'] }],
};
lib.tracks[0].categoryId = 'k1';

await test('exporta e reimporta preservando tudo (sem blobs, stored=false)', () => {
  const json = JSON.stringify(buildExport(lib));
  assert.ok(!json.includes('"blob"'));
  const r = parseImport(json); assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.data.tracks.length, 2); assert.equal(r.data.clips.length, 2); assert.equal(r.data.categories.length, 1); assert.equal(r.data.setlists[0].trackIds.length, 2);
  assert.equal(r.data.tracks[1].local?.stored, false); assert.equal(r.data.clips[0].rate, 0.75); assert.equal(r.data.clips[0].repetitions, 4);
  assert.equal(r.data.tracks[0].categoryId, 'k1');
});
await test('importar o mesmo arquivo duas vezes não duplica nada', () => {
  const r = parseImport(JSON.stringify(buildExport(lib))); if (!r.ok) throw new Error('x');
  const m = mergeLibraries(lib, r.data);
  assert.equal(m.library.tracks.length, 2); assert.equal(m.library.clips.length, 2); assert.equal(m.library.categories.length, 1); assert.equal(m.library.setlists.length, 1);
  assert.equal(m.report.tracksAdded, 0); assert.equal(m.report.clipsSkipped, 2);
  assert.equal(m.library.tracks[1].local?.stored, true, 'não perde o arquivo guardado');
});
await test('mesclar traz só o que é novo e mantém o existente', () => {
  const other: Library = { tracks: [mkTrack('1'), mkTrack('9')], clips: [mkClip('x1', '1', 10, 20), mkClip('x2', '1', 30, 40, 'Ponte'), mkClip('x3', '9', 1, 3)], categories: [{ id: 'z', name: 'LOUVOR' }, { id: 'z2', name: 'Ensaio' }], setlists: [{ id: 'q', name: 'Domingo', trackIds: ['9'] }] };
  const r = parseImport(JSON.stringify(buildExport(other))); if (!r.ok) throw new Error('x');
  const m = mergeLibraries(lib, r.data);
  assert.equal(m.library.tracks.length, 3); assert.equal(m.library.clips.length, 4); assert.equal(m.library.categories.length, 2);
  assert.equal(m.library.setlists.length, 1); assert.equal(m.library.setlists[0].trackIds.length, 3);
  assert.equal(m.library.clips.filter((c) => c.trackId === '1').length, 2);
});
await test('conflito de IDs com músicas diferentes gera novo ID sem sobrescrever', () => {
  const other: Library = { tracks: [mkTrack('1', { youtubeId: 'ZZZZZZZZZZZ', title: 'Outra' })], clips: [mkClip('c1', '1', 1, 5, 'X')], categories: [], setlists: [] };
  const r = parseImport(JSON.stringify(buildExport(other))); if (!r.ok) throw new Error('x');
  const m = mergeLibraries(lib, r.data);
  assert.equal(m.library.tracks.length, 3); assert.equal(new Set(m.library.tracks.map((t) => t.id)).size, 3); assert.equal(new Set(m.library.clips.map((c) => c.id)).size, 3);
  assert.equal(m.library.tracks.find((t) => t.id === '1')?.title, 'Música 1');
});
await test('substituir reaproveita arquivo local guardado e lista removidos', () => {
  const only: Library = { tracks: [lib.tracks[1]], clips: [], categories: [], setlists: [] };
  const r = parseImport(JSON.stringify(buildExport(only))); if (!r.ok) throw new Error('x');
  const m = mergeLibraries(lib, r.data, 'replace');
  assert.equal(m.library.tracks.length, 1); assert.equal(m.library.tracks[0].local?.stored, true); assert.deepEqual(m.removedTrackIds, ['1']);
});
await test('validação rejeita arquivos inválidos e sanitiza dados ruins', () => {
  assert.equal(parseImport('não é json').ok, false);
  assert.equal(parseImport('{"app":"outro","version":1}').ok, false);
  assert.equal(parseImport('{"app":"loop-musical","version":99}').ok, false);
  assert.equal(parseImport('{"app":"loop-musical","version":1,"tracks":"x"}').ok, false);
  const bad = { app: 'loop-musical', version: 1, tracks: [mkTrack('1'), { id: 'x' }, mkTrack('3', { youtubeId: 'curto' })], clips: [mkClip('c', '1', 5, 4), mkClip('d', '1', 1, 9), mkClip('e', 'naoexiste', 1, 9), { id: 'f', trackId: '1', start: 'a', end: 2 }], categories: [], setlists: [] };
  const r = parseImport(JSON.stringify(bad)); assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.data.tracks.length, 1); assert.equal(r.data.clips.length, 1); assert.equal(r.data.clips[0].id, 'd'); assert.ok(r.warnings.length >= 2);
});
await test('BPM é importado, validado e arquivos antigos recebem o padrão', () => {
  const lib = (bpm: unknown) => JSON.stringify({ app: 'loop-musical', version: 1, tracks: [mkTrack('1', { practice: { ...DEFAULT_PRACTICE, bpm } as never })], clips: [], categories: [], setlists: [] });
  const ok = parseImport(lib(128)); assert.ok(ok.ok && ok.data.tracks[0].practice.bpm === 128);
  const bad = parseImport(lib(9999)); assert.ok(bad.ok && bad.data.tracks[0].practice.bpm === DEFAULT_PRACTICE.bpm);
  const old = parseImport(lib(undefined)); assert.ok(old.ok && old.data.tracks[0].practice.bpm === 60);
});

console.log(`\n${passed} testes passaram`);
