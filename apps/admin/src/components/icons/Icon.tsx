import type { FC, CSSProperties } from 'react';
import { iconRegistry, type IconName } from './registry';

/**
 * Icon — renders a Barakath design-system glyph by name (spec/design: single materialized icon set).
 *
 * WHY a local registry (not an icon library): the glyphs are the design system's OWN materialized
 * set (extracted verbatim from the handoff bundle), so what renders is pixel-identical to the design
 * — no risk of a library version drawing a slightly different glyph. Icons paint with `currentColor`,
 * so color comes from the surrounding text color utility.
 */
export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

const Icon: FC<IconProps> = ({ name, size = 20, className, style, title }) => {
  const glyph = iconRegistry[name];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={glyph.viewBox}
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      // Safe: bodies are static, from our own generated registry (no user input).
      dangerouslySetInnerHTML={{ __html: glyph.body }}
    />
  );
};

export default Icon;
export type { IconName };
