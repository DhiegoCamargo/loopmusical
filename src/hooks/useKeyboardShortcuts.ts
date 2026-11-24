import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  togglePlay: () => void;
  skip: (delta: number) => void;
  volumeStep: (delta: number) => void;
  markA: () => void;
  markB: () => void;
  toggleLoop: () => void;
  clearRange: () => void;
  stepRate: (dir: 1 | -1) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  escape: () => void;
  showHelp: () => void;
}

export const SHORTCUTS: Array<{ keys: string; label: string }> = [
  { keys: 'Espaço', label: 'Reproduzir / pausar' },
  { keys: '← →', label: 'Voltar / avançar 5 segundos' },
  { keys: '↑ ↓', label: 'Volume' },
  { keys: 'A', label: 'Marcar ponto A na posição atual' },
  { keys: 'B', label: 'Marcar ponto B na posição atual' },
  { keys: 'L', label: 'Ligar / desligar repetição do trecho' },
  { keys: 'C', label: 'Limpar pontos A e B' },
  { keys: '[  ]', label: 'Velocidade menor / maior' },
  { keys: 'M', label: 'Silenciar' },
  { keys: 'F', label: 'Tela cheia' },
  { keys: 'Esc', label: 'Interromper o ensaio / fechar janelas' },
  { keys: '?', label: 'Mostrar esta lista' },
];

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Atalhos de teclado (computador). Ignorados enquanto o usuário digita. */
export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled: boolean): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const h = ref.current;
      if (e.key === 'Escape') return h.escape();
      if (isTyping(e.target)) return;
      const onButton = (e.target as HTMLElement | null)?.tagName === 'BUTTON';
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      switch (k) {
        case ' ':
          if (onButton) return; // o botão focado trata o próprio clique
          e.preventDefault();
          return h.togglePlay();
        case 'ArrowLeft':
          e.preventDefault();
          return h.skip(-5);
        case 'ArrowRight':
          e.preventDefault();
          return h.skip(5);
        case 'ArrowUp':
          e.preventDefault();
          return h.volumeStep(0.05);
        case 'ArrowDown':
          e.preventDefault();
          return h.volumeStep(-0.05);
        case 'a':
          return h.markA();
        case 'b':
          return h.markB();
        case 'l':
          return h.toggleLoop();
        case 'c':
          return h.clearRange();
        case '[':
          return h.stepRate(-1);
        case ']':
          return h.stepRate(1);
        case 'm':
          return h.toggleMute();
        case 'f':
          return h.toggleFullscreen();
        case '?':
          return h.showHelp();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
