# Loop Musical — Ouça. Repita. Aprenda.

Aplicativo web para estudar e ensaiar músicas com **loop A/B**, controle de velocidade, trechos salvos e modo de ensaio. Funciona com vídeos do YouTube (player oficial incorporado) e com arquivos locais de áudio/vídeo.

## Executar

Requer Node.js 18+.

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:5173
npm run build      # gera ./dist
npm run preview    # testa o build
npm test           # testes de lógica (links, motor de loop/ensaio, importação)
npm run typecheck
```

## Publicar

- **GitHub**: `git init && git add . && git commit -m "Loop Musical v1.0"` e envie para um repositório.
- **Vercel**: importe o repositório; o `vercel.json` já define Vite, `npm run build` e `dist`. Nenhuma variável de ambiente é necessária.

## Estrutura

```
src/
  types/            tipos (música, trecho, ensaio, biblioteca, estado da mídia)
  lib/              tempo, links do YouTube, ids
  services/
    media/          MediaController (contrato) · YouTubeController · LocalMediaController
    practice/       LoopEngine (loop A/B + sessões de ensaio), independente da fonte
    storage/        IndexedDB, preferências (LocalStorage), importação/exportação JSON
  hooks/            useStudySession (orquestra tudo), useLibrary, useMedia, useWaveform, atalhos
  components/       player, biblioteca, trechos, ensaio, ui
tests/run.ts        testes de lógica
```

A interface só conhece o contrato `MediaController`; para suportar uma nova fonte, implemente-o (ver `LocalMediaController`).

## Uso rápido

1. Cole um link do YouTube **ou** escolha um arquivo (MP3, WAV, MP4…).
2. Toque/clique em **Marcar A aqui** e **Marcar B aqui** (ou use as teclas `A` e `B`), ligue **Repetir trecho**.
3. Ajuste a velocidade. Salve o trecho com nome (Introdução, Refrão, Solo…).
4. Na aba **Ensaio**, defina repetições, pausa e velocidade progressiva e inicie.

Atalhos (computador): Espaço, ← →, ↑ ↓, A, B, L, C, [ ], M, F, Esc, ? (lista completa no app).

## Limitações conhecidas

- **YouTube**: a posição é lida ~20 vezes por segundo e o salto de volta a A depende da latência do player; pode haver uma pequena folga no ponto de retorno, e o loop não é perfeitamente contínuo. Para precisão máxima use arquivo local. Só são oferecidas as velocidades que o vídeo aceita. Vídeos que proíbem incorporação mostram aviso e link para abrir no YouTube. Com o foco dentro do vídeo, os atalhos de teclado não funcionam até clicar fora dele. Não há download, extração de áudio nem contorno de restrições.
- **Arquivos locais**: o loop é conferido a cada quadro (alta precisão, mas não sample-accurate). A preservação do tom ao mudar a velocidade depende do navegador. Formatos aceitos dependem do navegador.
- **Forma de onda**: real, só para áudio local até ~60 MB; para vídeo e YouTube é usada a linha do tempo convencional.
- **Armazenamento**: arquivos locais ficam no IndexedDB deste navegador (podem ser removidos pelo navegador se faltar espaço); se não puderem ser guardados, o app pede para selecionar o arquivo de novo. O JSON exportado **não** contém áudio/vídeo.
- Ícones: componente próprio no estilo Lucide (`src/components/ui/Icon.tsx`), sem dependência extra.
- Telas cheias em iPhone podem não ser suportadas pelo Safari.

## Fora do escopo desta versão

Transposição tonal, importação de PDFs litúrgicos, detecção automática de seções, integração com o site Ministério Fogo Abrasador, sincronização entre dispositivos e análise por IA.
