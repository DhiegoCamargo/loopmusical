import { useState } from 'react';
import { useLibrary } from '../../hooks/useLibrary';
import type { StudySession } from '../../hooks/useStudySession';
import { LOCAL_RATES } from '../../services/media/LocalMediaController';
import type { Clip } from '../../types';
import { formatClock, formatPrecise, formatRate, validateRange } from '../../lib/time';
import { Field, NumberField, TimeField } from '../ui/controls';
import { Icon } from '../ui/Icon';

function ClipEditor({ clip, session, onClose }: { clip: Clip; session: StudySession; onClose: () => void }) {
  const lib = useLibrary();
  const [name, setName] = useState(clip.name);
  const [start, setStart] = useState(clip.start);
  const [end, setEnd] = useState(clip.end);
  const [rate, setRate] = useState(clip.rate);
  const [reps, setReps] = useState(clip.repetitions);
  const [gap, setGap] = useState(clip.gap);
  const duration = session.media.duration;
  const check = validateRange(start, end, duration);
  const rates = session.controller ? session.media.availableRates : LOCAL_RATES;

  const save = () => {
    if (!check.ok) return;
    const patch = { name: name.trim() || clip.name, start, end, rate, repetitions: reps, gap };
    lib.updateClip(clip.id, patch);
    if (session.activeClipId === clip.id) session.selectClip({ ...clip, ...patch });
    onClose();
  };

  return (
    <div className="space-y-3 border-t border-ink-700 bg-ink-900/60 p-3">
      <Field label="Nome">
        <input className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Nome do trecho" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início (A)">
          <TimeField label="Início do trecho" value={start} onCommit={(v) => (v === null ? false : (setStart(v), true))} />
        </Field>
        <Field label="Fim (B)">
          <TimeField label="Fim do trecho" value={end} onCommit={(v) => (v === null ? false : (setEnd(v), true))} />
        </Field>
      </div>
      {session.a !== null && session.b !== null && (
        <button className="btn !py-1.5 text-xs" onClick={() => { setStart(session.a as number); setEnd(session.b as number); }}>
          Usar A e B atuais ({formatClock(session.a)}–{formatClock(session.b)})
        </button>
      )}
      {!check.ok && <p className="text-sm text-danger" role="alert">{check.message}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Velocidade">
          <select className="field" value={rates.includes(rate) ? rate : ''} onChange={(e) => setRate(parseFloat(e.target.value))} aria-label="Velocidade do trecho">
            {!rates.includes(rate) && <option value="">{formatRate(rate)}</option>}
            {rates.map((r) => <option key={r} value={r}>{formatRate(r)}</option>)}
          </select>
        </Field>
        <Field label="Pausa entre repetições">
          <NumberField label="Pausa em segundos" value={gap} onChange={setGap} min={0} max={60} step={0.5} suffix="s" />
        </Field>
      </div>
      <Field label="Repetições" hint="0 = repetir sem limite">
        <NumberField label="Repetições" value={reps} onChange={(v) => setReps(Math.floor(v))} min={0} max={999} />
      </Field>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={save} disabled={!check.ok}>
          <Icon name="check" size={16} /> Salvar
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

function ClipRow({ clip, index, count, session }: { clip: Clip; index: number; count: number; session: StudySession }) {
  const lib = useLibrary();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const active = session.activeClipId === clip.id;

  return (
    <li className={`overflow-hidden rounded-xl border transition ${active ? 'border-brand-500 bg-brand-500/10' : 'border-ink-700 bg-ink-800/60 hover:border-ink-600'}`}>
      <div className="flex items-center gap-1 pr-1">
        <button className="min-w-0 flex-1 p-3 text-left" onClick={() => session.selectClip(clip)} aria-current={active ? 'true' : undefined}>
          <span className="block truncate font-medium">{clip.name}</span>
          <span className="tabular block truncate text-xs text-ink-300">
            {formatPrecise(clip.start)} → {formatPrecise(clip.end)} · {formatRate(clip.rate)} · {clip.repetitions === 0 ? '∞ repetições' : `${clip.repetitions} rep.`}
            {clip.gap > 0 ? ` · pausa ${clip.gap}s` : ''}
          </span>
        </button>
        <div className="flex flex-col">
          <button className="icon-btn !size-7" disabled={index === 0} onClick={() => lib.moveClip(clip.id, -1)} aria-label="Subir trecho">
            <Icon name="chevron-up" size={16} />
          </button>
          <button className="icon-btn !size-7" disabled={index === count - 1} onClick={() => lib.moveClip(clip.id, 1)} aria-label="Descer trecho">
            <Icon name="chevron-down" size={16} />
          </button>
        </div>
        <button className="icon-btn !size-9" onClick={() => setEditing((v) => !v)} aria-label="Editar trecho" aria-expanded={editing}>
          <Icon name="pencil" size={17} />
        </button>
        {confirm ? (
          <button className="btn btn-danger !px-2 !py-1 text-xs" autoFocus onBlur={() => setConfirm(false)} onClick={() => lib.deleteClip(clip.id)}>
            Excluir?
          </button>
        ) : (
          <button className="icon-btn !size-9" onClick={() => setConfirm(true)} aria-label="Excluir trecho">
            <Icon name="trash" size={17} />
          </button>
        )}
      </div>
      {editing && <ClipEditor clip={clip} session={session} onClose={() => setEditing(false)} />}
    </li>
  );
}

export function ClipsPanel({ session }: { session: StudySession }) {
  const lib = useLibrary();
  const track = session.track;
  if (!track) return <p className="rounded-xl border border-dashed border-ink-600 p-4 text-center text-sm text-ink-300">Abra uma música para ver e salvar seus trechos.</p>;

  const clips = lib.clipsOf(track.id);
  const canSave = session.a !== null && session.b !== null;

  return (
    <div className="space-y-3">
      <button className="btn btn-primary w-full" disabled={!canSave} onClick={() => session.saveClip()}>
        <Icon name="bookmark" size={18} /> Salvar trecho A–B atual
      </button>
      {!canSave && <p className="text-xs text-ink-400">Marque os pontos A e B no player para salvar um trecho (por exemplo: Introdução, Refrão, Solo).</p>}
      {clips.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-600 p-4 text-center text-sm text-ink-300">Nenhum trecho salvo para esta música.</p>
      ) : (
        <ul className="space-y-2">
          {clips.map((c, i) => (
            <ClipRow key={c.id} clip={c} index={i} count={clips.length} session={session} />
          ))}
        </ul>
      )}
    </div>
  );
}
