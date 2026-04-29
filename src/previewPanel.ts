import * as vscode from 'vscode';
import { IconifyPack } from './iconResolver';

export class PreviewPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(private extensionUri: vscode.Uri) {}

  get isVisible(): boolean {
    return this.panel !== undefined;
  }

  show(viewColumn: vscode.ViewColumn = vscode.ViewColumn.Beside) {
    if (this.panel) {
      this.panel.reveal(viewColumn);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'mermaidPreview',
      'Mermaid Preview',
      viewColumn,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
        ],
      },
    );

    this.panel.webview.html = this.getHtmlContent(this.panel.webview);

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    }, null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(message),
      null,
      this.disposables,
    );
  }

  sendUpdate(text: string) {
    this.panel?.webview.postMessage({ type: 'update', text });
  }

  sendIconPacks(packs: IconifyPack[], packUrls: string[]) {
    this.panel?.webview.postMessage({ type: 'iconPacks', packs, packUrls });
  }

  sendTheme(mermaidTheme: string) {
    this.panel?.webview.postMessage({ type: 'theme', mermaidTheme });
  }

  requestExport(format: 'svg' | 'png') {
    this.panel?.webview.postMessage({ type: 'exportRequest', format });
  }

  onExportData(callback: (format: string, data: string) => void) {
    this.disposables.push({
      dispose: () => { this._exportCallback = undefined; },
    });
    this._exportCallback = callback;
  }

  private _exportCallback?: (format: string, data: string) => void;

  private async handleWebviewMessage(message: any) {
    if (message.type === 'exportData' && this._exportCallback) {
      this._exportCallback(message.format, message.data);
    }
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'main.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'styles.css'),
    );
    const nonce = getNonce();

    const config = vscode.workspace.getConfiguration('mermaidPreview');
    const packUrls: string[] = config.get<string[]>('iconPacks') || [];
    const connectSrc = packUrls.length > 0
      ? packUrls.map((u) => new URL(u).origin).join(' ') + ' '
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
      img-src ${webview.cspSource} https: data: blob:;
      script-src 'nonce-${nonce}';
      style-src ${webview.cspSource} 'unsafe-inline';
      connect-src ${connectSrc}https:;
      font-src ${webview.cspSource};">
  <link href="${styleUri}" rel="stylesheet">
  <title>Mermaid Preview</title>
</head>
<body>
  <div id="toolbar">
    <button id="btn-export-svg">Export SVG</button>
    <button id="btn-export-png">Export PNG</button>
  </div>
  <div id="diagram-container">
    <p style="opacity:0.5">Open a .mmd file and start typing to see the preview</p>
  </div>
  <div id="error-overlay"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose() {
    this.panel?.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
