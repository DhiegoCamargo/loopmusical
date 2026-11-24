/**
 * Carregamento da YouTube IFrame Player API oficial.
 * Nenhum vídeo é baixado nem interceptado: usamos apenas o player incorporado.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<any> | null = null;

export function loadYouTubeApi(timeoutMs = 15000): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Sem janela.'));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timer = window.setTimeout(() => {
      apiPromise = null;
      reject(new Error('A API do YouTube demorou demais para carregar. Verifique sua conexão.'));
    }, timeoutMs);

    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timer);
      previous?.();
      resolve(window.YT);
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      apiPromise = null;
      script.remove();
      reject(new Error('Não foi possível carregar o player do YouTube. Verifique sua conexão.'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export function youtubeErrorMessage(code: number): string {
  switch (code) {
    case 2:
      return 'O código do vídeo é inválido.';
    case 5:
      return 'O player do YouTube encontrou um erro ao reproduzir este vídeo.';
    case 100:
      return 'Vídeo não encontrado: ele foi removido ou está privado.';
    case 101:
    case 150:
      return 'O dono do vídeo não permite reprodução incorporada. Abra-o no YouTube ou use um arquivo local.';
    default:
      return 'Não foi possível reproduzir este vídeo.';
  }
}
