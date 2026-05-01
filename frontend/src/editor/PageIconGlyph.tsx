import { getSystemPageIconName } from "./systemIcons";

type PageIconGlyphProps = {
  icon: string;
  size?: number;
};

export function PageIconGlyph({ icon, size = 18 }: PageIconGlyphProps) {
  return (
    <span className="emoji-icon-glyph" aria-hidden="true" style={{ fontSize: size }}>
      {getSystemPageIconName(icon) ?? icon}
    </span>
  );
}
