// Adapted from DSG sysml_ide; Apache-2.0. See NOTICE.
export type Theme = 'light' | 'dark' | 'system';
export const diagramPalettes = [
  'neutral',
  'muted',
  'contrast',
  'forest',
  'blueprint',
  'paper',
] as const;
export type DiagramPalette = (typeof diagramPalettes)[number];
export const paletteLabels: Record<DiagramPalette, string> = {
  neutral: 'Neutral',
  muted: 'Muted element colors',
  contrast: 'High contrast',
  forest: 'Forest',
  blueprint: 'Blueprint blue',
  paper: 'Warm paper',
};
export const colorTargets = [
  'package',
  'definition',
  'usage',
  'portIn',
  'portOut',
  'portInout',
] as const;
export type ColorTarget = (typeof colorTargets)[number];
export type ElementColors = Partial<Record<ColorTarget, string>>;
export const colorLabels: Record<ColorTarget, string> = {
  package: 'Packages',
  definition: 'Part definitions',
  usage: 'Part usages',
  portIn: 'Input ports',
  portOut: 'Output ports',
  portInout: 'Bidirectional ports',
};
export const defaultBaseColors: Record<ColorTarget, string> = {
  package: '#64748b',
  definition: '#3b82f6',
  usage: '#10b981',
  portIn: '#3b82f6',
  portOut: '#f59e0b',
  portInout: '#0d9488',
};
const colorProperties: Record<ColorTarget, string> = {
  package: 'package',
  definition: 'definition',
  usage: 'usage',
  portIn: 'port-in',
  portOut: 'port-out',
  portInout: 'port-inout',
};
export interface Appearance {
  theme: Theme;
  palette: DiagramPalette;
  colors?: ElementColors;
}

export const appearanceKey = 'sysml-appearance-v1';
export const defaultAppearance: Appearance = {
  theme: 'light',
  palette: 'muted',
};

export function parseAppearance(text: string | null): Appearance {
  try {
    const value: unknown = JSON.parse(text ?? 'null');
    if (!value || typeof value !== 'object') return { ...defaultAppearance };
    const preferences = value as Record<string, unknown>;
    const colors = parseColors(preferences.colors);
    return {
      theme:
        preferences.theme === 'light' ||
        preferences.theme === 'dark' ||
        preferences.theme === 'system'
          ? preferences.theme
          : defaultAppearance.theme,
      palette:
        diagramPalettes.find((palette) => palette === preferences.palette) ??
        defaultAppearance.palette,
      ...(Object.keys(colors).length ? { colors } : {}),
    };
  } catch {
    return { ...defaultAppearance };
  }
}

function parseColors(value: unknown): ElementColors {
  const colors: ElementColors = {};
  if (!value || typeof value !== 'object') return colors;
  for (const target of colorTargets) {
    const color = (value as Record<string, unknown>)[target];
    if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))
      colors[target] = color.toLowerCase();
  }
  const legacyPort = (value as Record<string, unknown>).port;
  if (typeof legacyPort === 'string' && /^#[0-9a-f]{6}$/i.test(legacyPort)) {
    for (const target of ['portIn', 'portOut', 'portInout'] as const)
      colors[target] ??= legacyPort.toLowerCase();
  }
  return colors;
}

export function mutedColorProperties(
  colors: ElementColors | undefined,
  theme: 'light' | 'dark',
): Record<string, string> {
  const validated = parseColors(colors);
  return Object.fromEntries(
    colorTargets.flatMap((target) => {
      const color = validated[target];
      if (!color) return [];
      const base = [1, 3, 5].map((start) =>
        parseInt(color.slice(start, start + 2), 16),
      );
      const surface = theme === 'light' ? [255, 255, 255] : [24, 34, 49];
      const weight = theme === 'light' ? 0.12 : 0.18;
      const fill = base
        .map((channel, i) =>
          Math.round(channel * weight + surface[i]! * (1 - weight))
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
      return [[appearanceFillProperty(target), `#${fill}`]];
    }),
  );
}

export function mutedColorStyle(
  colors: ElementColors | undefined,
  theme: 'light' | 'dark',
): string {
  return Object.entries(mutedColorProperties(colors, theme))
    .map(([property, value]) => `${property}: ${value};`)
    .join(' ');
}

export function resolvedTheme(
  theme: Theme,
  systemDark: boolean,
): 'light' | 'dark' {
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

export function loadAppearance(storage: Pick<Storage, 'getItem'>): Appearance {
  try {
    return parseAppearance(storage.getItem(appearanceKey));
  } catch {
    return { ...defaultAppearance };
  }
}

export function saveAppearance(
  storage: Pick<Storage, 'setItem'>,
  appearance: Appearance,
): boolean {
  try {
    storage.setItem(appearanceKey, JSON.stringify(appearance));
    return true;
  } catch {
    return false;
  }
}

export function appearanceFillProperty(target: ColorTarget): string {
  return `--sysml-${colorProperties[target]}-bg`;
}
