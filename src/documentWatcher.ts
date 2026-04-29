import * as vscode from 'vscode';

export interface DebouncedFunction<T extends (...args: any[]) => void> {
  (...args: Parameters<T>): void;
  dispose(): void;
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delayMs: number): DebouncedFunction<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Parameters<T>) => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, delayMs);
  };

  debounced.dispose = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return debounced as DebouncedFunction<T>;
}

export class DocumentWatcher implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private debouncedUpdate: DebouncedFunction<(text: string) => void>;

  constructor(private onUpdate: (text: string) => void, delayMs = 300) {
    this.debouncedUpdate = debounce(onUpdate, delayMs);

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        const langId = e.document.languageId;
        if (langId === 'mermaid' && e.contentChanges.length > 0) {
          this.debouncedUpdate(e.document.getText());
        }
      }),
    );
  }

  dispose() {
    this.debouncedUpdate.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
