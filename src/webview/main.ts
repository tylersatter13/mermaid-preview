declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

import mermaid from 'mermaid';

interface IconifyPack {
  prefix: string;
  icons: Record<string, { body: string; width: number; height: number }>;
}

interface UpdateMessage {
  type: 'update';
  text: string;
}

interface IconPacksMessage {
  type: 'iconPacks';
  packs: IconifyPack[];
  packUrls: string[];
}

interface ThemeMessage {
  type: 'theme';
  mermaidTheme: string;
}

interface ExportRequestMessage {
  type: 'exportRequest';
  format: 'svg' | 'png';
}

type IncomingMessage = UpdateMessage | IconPacksMessage | ThemeMessage | ExportRequestMessage;

const vscodeApi = acquireVsCodeApi();
const diagramContainer = document.getElementById('diagram-container')!;
const errorOverlay = document.getElementById('error-overlay')!;

let currentTheme = 'dark';
let renderCounter = 0;
let lastGoodSvg = '';

function initMermaid(theme: string) {
  mermaid.initialize({
    startOnLoad: false,
    theme: theme as any,
    securityLevel: 'loose',
  });
}

async function registerPacks(packs: IconifyPack[], packUrls: string[]) {
  const iconPackConfigs: any[] = [];

  for (const pack of packs) {
    iconPackConfigs.push({
      name: pack.prefix,
      icons: pack,
    });
  }

  for (const url of packUrls) {
    iconPackConfigs.push({
      name: url,
      loader: () => fetch(url).then((res) => res.json()),
    });
  }

  if (iconPackConfigs.length > 0) {
    mermaid.registerIconPacks(iconPackConfigs);
  }
}

async function renderDiagram(text: string) {
  if (!text.trim()) {
    diagramContainer.innerHTML = '<p style="opacity:0.5">Enter a Mermaid diagram to see the preview</p>';
    errorOverlay.classList.remove('visible');
    return;
  }

  try {
    renderCounter++;
    const id = `mermaid-diagram-${renderCounter}`;
    const { svg } = await mermaid.render(id, text);
    diagramContainer.innerHTML = svg;
    lastGoodSvg = svg;
    errorOverlay.classList.remove('visible');
  } catch (err: any) {
    errorOverlay.textContent = err.message || String(err);
    errorOverlay.classList.add('visible');
  }
}

function exportSvg() {
  if (!lastGoodSvg) return;
  vscodeApi.postMessage({ type: 'exportData', format: 'svg', data: lastGoodSvg });
}

function exportPng() {
  if (!lastGoodSvg) return;

  const canvas = document.createElement('canvas');
  const img = new Image();
  const svgBlob = new Blob([lastGoodSvg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    canvas.width = img.naturalWidth * 2;
    canvas.height = img.naturalHeight * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    const dataUrl = canvas.toDataURL('image/png');
    vscodeApi.postMessage({ type: 'exportData', format: 'png', data: dataUrl });
  };
  img.src = url;
}

document.getElementById('btn-export-svg')?.addEventListener('click', exportSvg);
document.getElementById('btn-export-png')?.addEventListener('click', exportPng);

window.addEventListener('message', async (event) => {
  const message = event.data as IncomingMessage;

  switch (message.type) {
    case 'update':
      await renderDiagram(message.text);
      break;
    case 'iconPacks':
      await registerPacks(message.packs, message.packUrls);
      break;
    case 'theme':
      currentTheme = message.mermaidTheme;
      initMermaid(currentTheme);
      const state = vscodeApi.getState() as { lastText?: string } | undefined;
      if (state?.lastText) {
        await renderDiagram(state.lastText);
      }
      break;
    case 'exportRequest':
      if (message.format === 'svg') exportSvg();
      else exportPng();
      break;
  }

  if (message.type === 'update') {
    vscodeApi.setState({ lastText: message.text });
  }
});

initMermaid(currentTheme);
