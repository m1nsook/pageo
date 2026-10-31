import type { SVGProps } from "react";
import { siDiscord, siGithub, siNpm, type SimpleIcon } from "simple-icons";

/** Brand marks stay in Simple Icons, away from the general-purpose UI icon set.
 * Brand assets are monochrome/currentColor by default; do not recolor official
 * logos arbitrarily or imply brand endorsement.
 */
const brands = {
  discord: siDiscord,
  github: siGithub,
  npm: siNpm,
} satisfies Record<string, SimpleIcon>;

export type StudioBrand = keyof typeof brands;

export function BrandIcon({ brand, title, ...props }: {
  brand: StudioBrand;
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "children">) {
  const icon = brands[brand];
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...props}
    >
      <path d={icon.path} />
    </svg>
  );
}
