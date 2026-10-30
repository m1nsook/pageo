import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

type MonacoAPI = typeof import("monaco-editor");
type CodeEditorInstance = import("monaco-editor").editor.IStandaloneCodeEditor;
type CodeModel = import("monaco-editor").editor.ITextModel;
type SourceLanguage = "css" | "json" | "typescript" | "javascript" | "html" | "markdown";

/** Reusable VS Code-powered source editor. Workers are built by Vite as
 * separate assets and loaded by the desktop app, not a third-party CDN.
 * Monaco is imported on demand when a source file is actually opened.
 */
export function MonacoCodeEditor({
  value, onChange, onSave, language = "css", label = "Source code",
}: {
  value: string;
  onChange: (next: string) => void;
  onSave?: () => void;
  language?: SourceLanguage;
  label?: string;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const editor = useRef<CodeEditorInstance | null>(null);
  const model = useRef<CodeModel | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const valueRef = useRef(value);
  const [error, setError] = useState("");
  const { resolvedTheme } = useTheme();

  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  valueRef.current = value;

  useEffect(() => {
    let mounted = true;
    let subscription: { dispose(): void } | null = null;
    setError("");

    // Vite's worker imports ensure CSS, JSON, TS/JS and HTML language services
    // work without loading executable worker code from a remote origin.
    Object.assign(self, {
      MonacoEnvironment: {
        getWorker(_id: string, name: string) {
          switch (name) {
            case "css": case "scss": case "less": return new CssWorker();
            case "json": return new JsonWorker();
            case "html": case "handlebars": case "razor": return new HtmlWorker();
            case "typescript": case "javascript": return new TsWorker();
            default: return new EditorWorker();
          }
        },
      },
    });

    void import("monaco-editor").then((monaco: MonacoAPI) => {
      if (!mounted || !root.current) return;
      const nextModel = monaco.editor.createModel(valueRef.current, language);
      model.current = nextModel;
      const instance = monaco.editor.create(root.current, {
        model: nextModel,
        theme: resolvedTheme === "dark" ? "vs-dark" : "vs",
        fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
        fontSize: 13,
        lineHeight: 21,
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        padding: { top: 14, bottom: 16 },
        ariaLabel: label,
      });
      editor.current = instance;
      subscription = instance.onDidChangeModelContent(() => onChangeRef.current(instance.getValue()));
      instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSaveRef.current?.());
    }).catch(cause => {
      if (mounted) setError(cause instanceof Error ? cause.message : String(cause));
    });

    return () => {
      mounted = false;
      subscription?.dispose();
      editor.current?.dispose();
      model.current?.dispose();
      editor.current = null;
      model.current = null;
    };
    // Opening a new file changes language and creates a separate Monaco model.
    // Value, theme and handlers are synchronized in the effects below.
  }, [language, label]);

  useEffect(() => {
    const instance = editor.current;
    if (instance && instance.getValue() !== value) instance.setValue(value);
  }, [value]);

  useEffect(() => {
    const instance = editor.current;
    if (instance) {
      // Monaco's public API uses a globally shared editor theme.
      void import("monaco-editor").then(monaco =>
        monaco.editor.setTheme(resolvedTheme === "dark" ? "vs-dark" : "vs")
      );
    }
  }, [resolvedTheme]);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div ref={root} role="region" aria-label={label} className="absolute inset-0" />
      {error && (
        <div className="absolute inset-0 flex flex-col gap-2 overflow-hidden bg-background p-3">
          <p role="alert" className="shrink-0 text-xs text-destructive">
            Monaco could not load: {error}. You can still edit and save the file below.
          </p>
          <textarea
            aria-label={label}
            spellCheck={false}
            className="min-h-0 w-full flex-1 resize-none rounded-md border border-border bg-background p-3 font-mono text-sm text-foreground"
            value={value}
            onChange={event => onChange(event.target.value)}
            onKeyDown={event => {
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                event.stopPropagation();
                onSaveRef.current?.();
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
