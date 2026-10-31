import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const options = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

/** Paglora's explicit appearance control. Studio themes never recolor the
 * published website preview or change a documentation project's site theme.
 */
export function ThemeSwitcher({ showLabel = false }: { showLabel?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  if (showLabel) {
    return (
      <div role="group" aria-label="Studio appearance" className="flex w-full max-w-sm items-center gap-1 rounded-md border border-border bg-muted/50 p-1">
        {options.map(({ value, label, Icon }) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={theme === value ? "secondary" : "ghost"}
            aria-pressed={theme === value}
            className={`min-w-0 flex-1 gap-2 ${theme === value ? "border border-border bg-card shadow-sm" : ""}`}
            onClick={() => setTheme(value)}
          >
            <Icon aria-hidden="true" className="size-4" />
            <span>{label}</span>
          </Button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Change Studio appearance">
              {resolvedTheme === "dark" ? <Moon aria-hidden="true" className="size-4" /> : <Sun aria-hidden="true" className="size-4" />}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">Studio appearance</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          {options.map(({ value, label, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden="true" className="size-4" /> {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
