import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

// Vite bundles the workers as local application assets; no CDN loader or
// separately installed copy of VS Code is required.
const scope = self as typeof self & {
  MonacoEnvironment?: { getWorker: (_moduleId: string, label: string) => Worker };
};
scope.MonacoEnvironment = {
  getWorker: (_moduleId, label) => {
    if (label === "css" || label === "scss" || label === "less") return new CssWorker();
    if (label === "json") return new JsonWorker();
    if (label === "html" || label === "handlebars" || label === "razor") return new HtmlWorker();
    if (label === "typescript" || label === "javascript") return new TsWorker();
    return new EditorWorker();
  },
};

export function MonacoCodeEditor({
  value, language, onChange, onSave, ariaLabel,
}: {
  value: string;
  language: "css" | "markdown" | "typescript" | "javascript" | "json" | "html";
  onChange: (next: string) => void;
  onSave: () => void;
  ariaLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const editor = monaco.editor.create(container, {
      value,
      language,
      ariaLabel,
      automaticLayout: true,
      fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
      fontSize: 13,
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: false,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on",
      padding: { top: 14, bottom: 14 },
      bracketPairColorization: { enabled: true },
      renderWhitespace: "selection",
    });
    editorRef.current = editor;
    const changeSubscription = editor.onDidChangeModelContent(() => {
      onChangeRef.current(editor.getValue());
    });
    editor.addAction({
      id: "paglora-save-source",
      label: "Save project source file",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => onSaveRef.current(),
    });

    const root = document.documentElement;
    const applyTheme = () =>
      monaco.editor.setTheme(root.classList.contains("dark") ? "vs-dark" : "vs");
    applyTheme();
    const observer = new MutationObserver(applyTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      changeSubscription.dispose();
      editorRef.current = null;
      editor.dispose();
    };
    // Recreate the language model when the file type changes. The value is
    // synchronized separately to avoid losing cursor position on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, ariaLabel]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.getValue() !== value) editor.setValue(value);
  }, [value]);

  return <div ref={containerRef} className="h-full min-h-0 w-full" role="region" aria-label={ariaLabel} />;
}
