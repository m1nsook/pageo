import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TranslationProvider } from "./i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="paglora-color-theme">
      <TranslationProvider>
        <TooltipProvider delayDuration={300}>
          <App />
        </TooltipProvider>
      </TranslationProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
