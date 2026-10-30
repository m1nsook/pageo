import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50",
  { variants: {
      variant: {
        default: "border-transparent bg-indigo-600 text-white",
        secondary: "border-zinc-200 bg-zinc-50 text-zinc-600",
        outline: "border-zinc-200 bg-white text-zinc-600",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
      },
    }, defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };
