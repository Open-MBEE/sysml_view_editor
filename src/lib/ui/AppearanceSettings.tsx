import {
  NativeSelect,
  NativeSelectOption,
} from '$lib/ui/primitives/native-select';
import { Input } from '$lib/ui/primitives/input';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Button } from './primitives/button';
import { Dialog } from './Dialog';
import {
  colorLabels,
  defaultAppearance,
  defaultBaseColors,
  diagramPalettes,
  loadAppearance,
  mutedColorProperties,
  paletteLabels,
  resolvedTheme,
  saveAppearance,
  type Appearance,
  type DiagramPalette,
  type Theme,
} from './appearance';

// This module owns browser preferences; no model/session operation is involved.
export function AppearanceSettings() {
  const [open, setOpen] = useState(false);
  const [appearance, setAppearance] = useState(() => {
    try {
      return loadAppearance(window.localStorage);
    } catch {
      return { ...defaultAppearance };
    }
  });
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const [saveFailed, setSaveFailed] = useState(false);
  const theme = resolvedTheme(appearance.theme, systemDark);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const changed = () => setSystemDark(media.matches);
    changed();
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add('sysml-appearance');
    root.dataset.theme = theme;
    root.dataset.palette = appearance.palette;
    const properties =
      appearance.palette === 'muted'
        ? mutedColorProperties(appearance.colors, theme)
        : {};
    for (const [key, value] of Object.entries(properties))
      root.style.setProperty(key, value);
    return () => {
      root.classList.remove('sysml-appearance');
      delete root.dataset.theme;
      delete root.dataset.palette;
      for (const key of Object.keys(properties)) root.style.removeProperty(key);
    };
  }, [appearance, theme]);

  function update(next: Appearance) {
    setAppearance(next);
    try {
      setSaveFailed(!saveAppearance(window.localStorage, next));
    } catch {
      setSaveFailed(true);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        Appearance
      </Button>
      <Dialog open={open} title="Appearance" onClose={() => setOpen(false)}>
        <div className="appearance-options">
          <p>Choose a light or dark theme and a coordinated color palette.</p>
          <label htmlFor="appearance-theme">Theme</label>
          <NativeSelect
            id="appearance-theme"
            value={appearance.theme}
            onChange={(event) =>
              update({ ...appearance, theme: event.target.value as Theme })
            }
          >
            <NativeSelectOption value="light">Light</NativeSelectOption>
            <NativeSelectOption value="dark">Dark</NativeSelectOption>
            <NativeSelectOption value="system">
              Follow system
            </NativeSelectOption>
          </NativeSelect>
          <label htmlFor="appearance-palette">Diagram palette</label>
          <NativeSelect
            id="appearance-palette"
            value={appearance.palette}
            onChange={(event) =>
              update({
                ...appearance,
                palette: event.target.value as DiagramPalette,
              })
            }
          >
            {diagramPalettes.map((palette) => (
              <NativeSelectOption key={palette} value={palette}>
                {paletteLabels[palette]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {appearance.palette === 'muted' && (
            <details>
              <summary>Element base colors</summary>
              <div className="color-options">
                {(['package', 'definition', 'usage'] as const).map((target) => (
                  <div key={target}>
                    <label htmlFor={'color-' + target}>
                      {colorLabels[target]}
                    </label>
                    <Input
                      type="color"
                      id={'color-' + target}
                      value={
                        appearance.colors?.[target] ?? defaultBaseColors[target]
                      }
                      onChange={(event) =>
                        update({
                          ...appearance,
                          colors: {
                            ...appearance.colors,
                            [target]: event.target.value,
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  update({
                    theme: appearance.theme,
                    palette: appearance.palette,
                  })
                }
              >
                Reset colors
              </Button>
            </details>
          )}
          {saveFailed && (
            <p role="alert" className="dialog-error">
              Appearance applies for this visit, but the browser could not save
              it.
            </p>
          )}
          <div className="dialog-actions">
            <Button variant="default" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
