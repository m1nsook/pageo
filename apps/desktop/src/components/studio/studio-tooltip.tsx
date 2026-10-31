import type { ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Studio-only tooltip with the current Paglora surface and typography.
 * Keep aria-label on icon-only controls; avoid browser-native title attributes.
 */
export function StudioTooltip({ label, children, side = "bottom" }: {
  label: string;
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
