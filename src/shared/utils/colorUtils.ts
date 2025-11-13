export type RGB = { r: number; g: number; b: number };

export const rgbToHex = ({ r, g, b }: RGB): string => {
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(Math.round(r))}${toHex(Math.round(g))}${toHex(
    Math.round(b)
  )}`;
};

export const hexToRgb = (hex: string): RGB => {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
};
