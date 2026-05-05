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
      // Capture the active editor before showing the panel (which shifts focus)
      const editor = vscode.window.activeTextEditor;

      previewPanel.show();

      // Wait for webview script to initialize before sending any data
      await previewPanel.whenReady();

      // Resolve and send icons before initial content so they're registered first
      await sendIcons(cacheDir, context);

      // Send theme
      sendTheme();

      // Send initial content from active editor (after icons are registered)
      if (editor && editor.document.languageId === 'mermaid') {
        previewPanel.sendUpdate(editor.document.getText());
      }

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
        await sendIcons(cacheDir, context);
        // Re-render with newly registered icons
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.languageId === 'mermaid') {
          previewPanel?.sendUpdate(activeEditor.document.getText());
        }
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

async function sendIcons(cacheDir: string, context: vscode.ExtensionContext) {
  if (!previewPanel) return;

  const config = vscode.workspace.getConfiguration('mermaidPreview');
  const icons = config.get<Record<string, string>>('icons') || {};
  const packEntries = config.get<string[]>('iconPacks') || [];
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  const packs = await resolveAllIcons(icons, workspaceRoot, cacheDir);

  // Separate local files from remote URLs
  const packUrls: string[] = [];
  for (const entry of packEntries) {
    if (entry.startsWith('http://') || entry.startsWith('https://')) {
      packUrls.push(entry);
    } else {
      // Local file path — resolve and load on the extension side
      let absPath: string | undefined;
      if (path.isAbsolute(entry)) {
        absPath = entry;
      } else {
        // Search multiple locations for relative paths
        const candidates: string[] = [];
        if (workspaceRoot) {
          candidates.push(path.resolve(workspaceRoot, entry));
        }
        const activeDoc = vscode.window.activeTextEditor?.document;
        if (activeDoc && !activeDoc.isUntitled) {
          candidates.push(path.resolve(path.dirname(activeDoc.uri.fsPath), entry));
        }
        // Also try relative to extension install directory
        candidates.push(path.resolve(context.extensionUri.fsPath, entry));

        for (const candidate of candidates) {
          try {
            await vscode.workspace.fs.stat(vscode.Uri.file(candidate));
            absPath = candidate;
            break;
          } catch {
            // Not found at this location, try next
          }
        }
        if (!absPath) {
          console.warn(`Cannot find icon pack "${entry}" in any of: ${candidates.join(', ')}`);
          continue;
        }
      }
      try {
        const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(absPath));
        const json = JSON.parse(Buffer.from(raw).toString('utf-8'));
        if (json.prefix && json.icons) {
          packs.push({ prefix: json.prefix, icons: json.icons });
        } else {
          console.warn(`Icon pack "${absPath}" missing prefix or icons`);
        }
      } catch (err) {
        console.warn(`Failed to load icon pack "${absPath}":`, err);
      }
    }
  }

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
