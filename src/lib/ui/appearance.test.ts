// Adapted from DSG sysml_ide; Apache-2.0. See NOTICE.
import { describe, expect, it } from 'vitest';
import {
  appearanceKey,
  defaultAppearance,
  diagramPalettes,
  loadAppearance,
  mutedColorStyle,
  parseAppearance,
  resolvedTheme,
  saveAppearance,
} from './appearance';

describe('appearance preferences', () => {
  it('defaults safely for missing, corrupt and non-object browser data', () => {
    expect(defaultAppearance).toEqual({ theme: 'light', palette: 'muted' });
    for (const value of [
      null,
      '',
      '{invalid',
      'null',
      'false',
      '42',
      '"dark"',
      '[]',
    ]) {
      expect(parseAppearance(value)).toEqual(defaultAppearance);
    }
  });
  it('validates fields independently and discards unknown settings', () => {
    expect(
      parseAppearance('{"theme":"dark","palette":"muted","source":"ignored"}'),
    ).toEqual({ theme: 'dark', palette: 'muted' });
    expect(parseAppearance('{"theme":"invalid","palette":"contrast"}')).toEqual(
      { theme: 'light', palette: 'contrast' },
    );
    expect(parseAppearance('{"theme":"light","palette":{}}')).toEqual({
      theme: 'light',
      palette: 'muted',
    });
    expect(parseAppearance('{"theme":"system","palette":"neutral"}')).toEqual({
      theme: 'system',
      palette: 'neutral',
    });
  });
  it('round-trips every preset while retaining custom muted colors', () => {
    for (const palette of diagramPalettes) {
      const preferences = {
        theme: 'dark',
        palette,
        colors: { usage: '#123456' },
      };
      expect(parseAppearance(JSON.stringify(preferences))).toEqual(preferences);
    }
    expect(parseAppearance('{"palette":"unknown"}')).toEqual(defaultAppearance);
  });
  it('follows the system only when selected', () => {
    expect(resolvedTheme('system', true)).toBe('dark');
    expect(resolvedTheme('system', false)).toBe('light');
    expect(resolvedTheme('light', true)).toBe('light');
    expect(resolvedTheme('dark', false)).toBe('dark');
  });
  it('round-trips preferences with an isolated storage key', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    expect(
      saveAppearance(storage, { theme: 'dark', palette: 'contrast' }),
    ).toBe(true);
    expect([...values.keys()]).toEqual([appearanceKey]);
    expect(loadAppearance(storage)).toEqual({
      theme: 'dark',
      palette: 'contrast',
    });
  });
  it('handles denied reads and quota failures without breaking the workspace', () => {
    const storage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadAppearance(storage)).toEqual(defaultAppearance);
    expect(saveAppearance(storage, defaultAppearance)).toBe(false);
  });
  it('retains valid custom colors in old and new preference records', () => {
    const preferences = parseAppearance(
      '{"theme":"dark","palette":"muted","colors":{"usage":"#FF00CC","port":"#000000"}}',
    );
    expect(preferences.colors).toEqual({
      usage: '#ff00cc',
      portIn: '#000000',
      portOut: '#000000',
      portInout: '#000000',
    });
    expect(parseAppearance(JSON.stringify(preferences))).toEqual(preferences);
    expect(parseAppearance('{"theme":"dark","palette":"muted"}')).toEqual({
      theme: 'dark',
      palette: 'muted',
    });
  });
  it('rejects malformed colors and prevents arbitrary CSS declarations', () => {
    for (const colors of [
      null,
      'red',
      [],
      { usage: '#abc' },
      { port: '#123456; color: red' },
      { definition: 123 },
      { unknown: '#123456' },
    ]) {
      expect(parseAppearance(JSON.stringify({ colors }))).toEqual(
        defaultAppearance,
      );
    }
    expect(mutedColorStyle({ usage: 'red' }, 'light')).toBe('');
    expect(mutedColorStyle(undefined, 'dark')).toBe('');
    expect(
      parseAppearance('{"colors":{"usage":"bad","portIn":"#abcdef"}}').colors,
    ).toEqual({ portIn: '#abcdef' });
  });
  it('migrates the old shared port color while preserving direction-specific overrides', () => {
    const preferences = parseAppearance(
      '{"palette":"muted","colors":{"port":"#ff0000","portIn":"#0000ff"}}',
    );
    expect(preferences.colors).toEqual({
      portIn: '#0000ff',
      portOut: '#ff0000',
      portInout: '#ff0000',
    });
    const style = mutedColorStyle(preferences.colors, 'light');
    expect(style).toContain('--sysml-port-in-bg: #e0e0ff;');
    expect(style).toContain('--sysml-port-out-bg: #ffe0e0;');
    expect(style).toContain('--sysml-port-inout-bg: #ffe0e0;');
  });
  it('keeps normal and secondary text readable for extreme and intermediate custom colors', () => {
    function luminance(color: string): number {
      const rgb = [1, 3, 5]
        .map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
    }
    for (const theme of ['light', 'dark'] as const)
      for (const r of ['00', '80', 'ff'])
        for (const g of ['00', '80', 'ff'])
          for (const b of ['00', '80', 'ff']) {
            const style = mutedColorStyle({ usage: `#${r}${g}${b}` }, theme);
            const fill = luminance(style.match(/#[0-9a-f]{6}/)![0]);
            for (const text of theme === 'light'
              ? ['#1e293b', '#475569']
              : ['#e2e8f0', '#b2bfd0']) {
              const foreground = luminance(text);
              expect(
                (Math.max(fill, foreground) + 0.05) /
                  (Math.min(fill, foreground) + 0.05),
              ).toBeGreaterThanOrEqual(4.5);
            }
          }
  });
});
