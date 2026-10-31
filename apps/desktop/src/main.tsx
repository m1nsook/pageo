import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TranslationProvider } from "./i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "next-themes";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@/lib/projects";
import "./index.css";

/** Keep Windows' native caption in step with Studio appearance.
 * This does not remove decorations or interfere with native window controls.
 */
function NativeWindowTheme() {
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    if (!isTauri() || !resolvedTheme) return;
    void getCurrentWindow()
      .setTheme(resolvedTheme === "dark" ? "dark" : "light")
      .catch((error: unknown) => console.warn("Could not synchronize native window theme", error));
  }, [resolvedTheme]);

  return null;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange storageKey="paglora-color-theme">
      <NativeWindowTheme />
      <TranslationProvider>
        <TooltipProvider delayDuration={300}>
          <App />
        </TooltipProvider>
      </TranslationProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
