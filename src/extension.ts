import * as vscode from 'vscode';
import * as path from 'path';
import { PreviewPanel } from './previewPanel';
import { resolveAllIcons, IconifyPack } from './iconResolver';
import { DocumentWatcher } from './documentWatcher';

let previewPanel: PreviewPanel | undefined;
let documentWatcher: DocumentWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
  const cacheDir = path.join(context.globalStorageUri.fsPath, 'icon-cache');

  // Open Preview command
  context.subscriptions.push(
    vscode.commands.registerCommand('mermaidPreview.openPreview', async () => {
      if (!previewPanel) {
        previewPanel = new PreviewPanel(context.extensionUri);
      }
      previewPanel.show();

      // Send initial content from active editor
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'mermaid') {
        previewPanel.sendUpdate(editor.document.getText());
      }

      // Resolve and send icons
      await sendIcons(cacheDir);

      // Send theme
      sendTheme();

      // Set up export handler
      previewPanel.onExportData(async (format, data) => {
        await handleExport(format, data);
      });

      // Set up document watcher if not already
      if (!documentWatcher) {
        documentWatcher = new DocumentWatcher((text) => {
          previewPanel?.sendUpdate(text);
        });
        context.subscriptions.push(documentWatcher);
      }
    }),
  );

  // Export SVG command
  context.subscriptions.push(
    vscode.commands.registerCommand('mermaidPreview.exportSVG', () => {
      previewPanel?.requestExport('svg');
    }),
  );

  // Export PNG command
  context.subscriptions.push(
    vscode.commands.registerCommand('mermaidPreview.exportPNG', () => {
      previewPanel?.requestExport('png');
    }),
  );

  // Re-resolve icons when settings change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('mermaidPreview.icons') || e.affectsConfiguration('mermaidPreview.iconPacks')) {
        await sendIcons(cacheDir);
      }
      if (e.affectsConfiguration('mermaidPreview.theme')) {
        sendTheme();
      }
    }),
  );

  // Re-send theme when VS Code theme changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme(() => {
      sendTheme();
    }),
  );

  // Send content when switching to a mermaid editor
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.languageId === 'mermaid' && previewPanel?.isVisible) {
        previewPanel.sendUpdate(editor.document.getText());
      }
    }),
  );
}

async function sendIcons(cacheDir: string) {
  if (!previewPanel) return;

  const config = vscode.workspace.getConfiguration('mermaidPreview');
  const icons = config.get<Record<string, string>>('icons') || {};
  const packUrls = config.get<string[]>('iconPacks') || [];
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  const packs = await resolveAllIcons(icons, workspaceRoot, cacheDir);
  previewPanel.sendIconPacks(packs, packUrls);
}

function sendTheme() {
  if (!previewPanel) return;

  const config = vscode.workspace.getConfiguration('mermaidPreview');
  const themeSetting = config.get<string>('theme') || 'auto';

  let mermaidTheme: string;
  if (themeSetting === 'auto') {
    const kind = vscode.window.activeColorTheme.kind;
    mermaidTheme = (kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight)
      ? 'default'
      : 'dark';
  } else {
    mermaidTheme = themeSetting === 'light' ? 'default' : 'dark';
  }

  previewPanel.sendTheme(mermaidTheme);
}

async function handleExport(format: string, data: string) {
  const filters = format === 'svg'
    ? { 'SVG Image': ['svg'] }
    : { 'PNG Image': ['png'] };

  const uri = await vscode.window.showSaveDialog({
    filters,
    defaultUri: vscode.Uri.file(`diagram.${format}`),
  });

  if (!uri) return;

  if (format === 'svg') {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(data, 'utf-8'));
  } else {
    // data is a data URL: "data:image/png;base64,..."
    const base64 = data.split(',')[1];
    await vscode.workspace.fs.writeFile(uri, Buffer.from(base64, 'base64'));
  }

  vscode.window.showInformationMessage(`Exported diagram as ${format.toUpperCase()}`);
}

export function deactivate() {
  previewPanel?.dispose();
  documentWatcher?.dispose();
}
