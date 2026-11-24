import type { ReactNode } from 'react';
import type { StudySession } from '../../hooks/useStudySession';
import { LOCAL_RATES } from '../../services/media/LocalMediaController';
import { buildRateSteps } from '../../services/practice/LoopEngine';
import { formatClock, formatRate } from '../../lib/time';
import { Field, NumberField, Switch } from '../ui/controls';
import { Icon } from '../ui/Icon';

export function PracticePanel({ session, tempo }: { session: StudySession; tempo?: ReactNode }) {
  const { practice, engineSnap: snap, media, a, b } = session;
  const active = snap.session;
  const hasRange = a !== null && b !== null;
  const rates = session.controller ? media.availableRates : LOCAL_RATES;
  const infinite = practice.repetitions === 0;
  const steps = practice.progressive ? buildRateSteps(practice.startRate, practice.targetRate, rates) : [];
  const minToReach = Math.max(0, steps.length - 1) * practice.repsPerStep + 1;
  const willNotReachTarget = practice.progressive && !infinite && practice.repetitions < minToReach;

  if (!session.track) {
    return <p className="rounded-xl border border-dashed border-ink-600 p-4 text-center text-sm text-ink-300">Abra uma música para usar o modo de ensaio.</p>;
  }

  const rateSelect = (value: number, onChange: (v: number) => void, label: string) => (
    <select
      className="field tabular"
      aria-label={label}
      disabled={active}
      value={rates.find((r) => Math.abs(r - value) < 1e-6) ?? ''}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    >
      {!rates.some((r) => Math.abs(r - value) < 1e-6) && <option value="">{formatRate(value)}</option>}
      {rates.map((r) => (
        <option key={r} value={r}>{formatRate(r)}</option>
      ))}
    </select>
  );

  return (
    <div className="space-y-4">
      {/* Estado da sessão */}
      <div className={`rounded-2xl border p-4 ${active ? 'border-brand-500 bg-brand-500/10' : 'border-ink-700 bg-ink-800/60'}`} aria-live="polite">
        {snap.phase === 'idle' && (
          <p className="text-sm text-ink-200">
            {hasRange
              ? `Pronto para ensaiar o trecho ${formatClock(a as number)}–${formatClock(b as number)}.`
              : 'Marque os pontos A e B no player para ensaiar um trecho.'}
          </p>
        )}
        {active && (
          <div className="space-y-1">
            <p className="label">{snap.phase === 'gap' ? 'Pausa entre repetições' : snap.phase === 'countin' ? `Contagem ${snap.countBeat} de ${snap.countTotal}` : 'Ensaio em andamento'}</p>
            <p className="tabular text-3xl font-bold text-brand-300">
              {snap.completed}
              <span className="text-lg font-medium text-ink-300">{snap.total > 0 ? ` de ${snap.total}` : ' repetições'}</span>
            </p>
            <p className="tabular text-sm text-ink-200">
              Velocidade {formatRate(snap.currentRate)}
              {snap.phase === 'gap' && ` · próxima em ${snap.gapRemaining.toFixed(1)} s`}
            </p>
          </div>
        )}
        {snap.phase === 'finished' && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 font-semibold text-brand-300">
              <Icon name="check" size={18} /> Sessão concluída: {snap.completed} repetições
            </p>
            <button className="btn" onClick={session.dismissFinished}>Fechar aviso</button>
          </div>
        )}
      </div>

      {active ? (
        <button className="btn w-full !py-3 text-base !border-danger/50 !text-danger hover:!bg-danger/10" onClick={session.stopPractice}>
          <Icon name="stop" size={18} /> Interromper ensaio
        </button>
      ) : (
        <button className="btn btn-primary w-full !py-3 text-base" disabled={!hasRange || !session.controller} onClick={() => session.startPractice()}>
          <Icon name="play" size={18} /> Iniciar ensaio
        </button>
      )}
      {session.rangeError && !hasRange && <p className="text-sm text-danger" role="alert">{session.rangeError}</p>}

      {/* Configuração */}
      <div className="card space-y-4 p-4">
        <Field label="Repetições">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={infinite} onChange={(v) => session.updatePractice({ repetitions: v ? 0 : 5 })} label="Repetição infinita" disabled={active} />
              Infinito
            </label>
            {!infinite && (
              <NumberField label="Quantidade de repetições" value={practice.repetitions} onChange={(v) => session.updatePractice({ repetitions: Math.max(1, Math.floor(v)) })} min={1} max={999} disabled={active} />
            )}
          </div>
        </Field>

        <Field label="Pausa entre repetições" hint="0 = sem pausa">
          <NumberField label="Pausa em segundos" value={practice.gap} onChange={(v) => session.updatePractice({ gap: v })} min={0} max={60} step={0.5} suffix="s" disabled={active} />
        </Field>

        <div className="space-y-3 border-t border-ink-700 pt-4">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">Contagem antes de iniciar</span>
              <span className="block text-xs text-ink-400">Conta 1, 2, 3… com clique e só então toca.</span>
            </span>
            <Switch checked={practice.countIn > 0} onChange={(v) => session.updatePractice({ countIn: v ? 3 : 0 })} label="Contagem antes de iniciar" disabled={active} />
          </label>
          {practice.countIn > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <select className="field !w-auto" aria-label="Tempos da contagem (ensaio)" value={practice.countIn} disabled={active} onChange={(e) => session.updatePractice({ countIn: parseInt(e.target.value, 10) })}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n} tempos</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-ink-200">
                <input type="checkbox" className="accent-[#34e0cc]" checked={practice.countEach} disabled={active} onChange={(e) => session.updatePractice({ countEach: e.target.checked })} />
                Repetir a contagem a cada volta
              </label>
            </div>
          )}
          {practice.countIn > 0 && tempo}
        </div>

        <div className="space-y-3 border-t border-ink-700 pt-4">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">Velocidade progressiva</span>
              <span className="block text-xs text-ink-400">Começa devagar e sobe até a velocidade-alvo.</span>
            </span>
            <Switch checked={practice.progressive} onChange={(v) => session.updatePractice({ progressive: v })} label="Velocidade progressiva" disabled={active} />
          </label>
          {practice.progressive && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Inicial">
                  {rateSelect(practice.startRate, (v) => session.updatePractice({ startRate: v, targetRate: Math.max(v, practice.targetRate) }), 'Velocidade inicial')}
                </Field>
                <Field label="Alvo">
                  {rateSelect(practice.targetRate, (v) => session.updatePractice({ targetRate: v, startRate: Math.min(v, practice.startRate) }), 'Velocidade-alvo')}
                </Field>
              </div>
              <Field label="Repetições por degrau">
                <NumberField label="Repetições por degrau" value={practice.repsPerStep} onChange={(v) => session.updatePractice({ repsPerStep: Math.max(1, Math.floor(v)) })} min={1} max={99} disabled={active} />
              </Field>
              <p className="tabular text-xs text-ink-300">
                Degraus: {steps.map(formatRate).join(' → ')}
              </p>
              {willNotReachTarget && (
                <p className="text-xs text-warn">
                  Com {practice.repetitions} repetições a sessão termina antes de chegar ao alvo. Para chegar a {formatRate(practice.targetRate)} use ao menos {minToReach}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-ink-400">
        O ensaio usa o trecho A–B atual. Use <kbd className="rounded bg-ink-700 px-1">Esc</kbd> para interromper a qualquer momento.
        {session.controller?.kind === 'youtube' && ' Só são oferecidas as velocidades que o vídeo do YouTube aceita.'}
      </p>
    </div>
  );
}
