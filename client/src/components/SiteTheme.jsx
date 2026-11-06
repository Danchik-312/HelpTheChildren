import { useEffect } from 'react';
import { useSite } from '../hooks/useContent';

const isHexColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const darkText = '#231B16';
const whiteText = '#FFFFFF';

function luminance(color) {
  const weights = [0.2126, 0.7152, 0.0722];
  return weights.reduce((total, weight, index) => {
    const channel = Number.parseInt(color.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return total + weight * linear;
  }, 0);
}

function contrast(first, second) {
  const a = luminance(first) + 0.05;
  const b = luminance(second) + 0.05;
  return Math.max(a, b) / Math.min(a, b);
}

function readableText(background) {
  if (contrast(background, darkText) >= 4.5) return darkText;
  return contrast(background, whiteText) >= 4.5 ? whiteText : '#000000';
}

export default function SiteTheme() {
  const { data } = useSite();
  const brand = data?.organization?.brandColor;
  const accent = data?.organization?.accentColor;

  useEffect(() => {
    const root = document.documentElement.style;
    const tokens = {};
    if (isHexColor(brand)) {
      const color = readableText(brand);
      tokens['--color-brand-orange'] = brand;
      tokens['--color-on-brand-orange'] = color;
      tokens['--brand-icon-invert'] = color === whiteText ? '1' : '0';
    }
    if (isHexColor(accent)) {
      tokens['--color-accent'] = accent;
      tokens['--color-on-accent'] = readableText(accent);
    }
    for (const [name, value] of Object.entries(tokens)) root.setProperty(name, value);
    return () => Object.keys(tokens).forEach(name => root.removeProperty(name));
  }, [brand, accent]);

  return null;
}
