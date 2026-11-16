import { CodeXml, Columns2, Layers } from 'lucide-react';
import { IconButton } from '$lib/ui/IconButton';

export function ArrangementSelector({
  mode,
  onMode,
}: {
  mode: 'code' | 'split' | 'diagram';
  onMode: (mode: 'code' | 'split' | 'diagram') => void;
}) {
  return (
    <div className="modes" role="group" aria-label="Workspace arrangement">
      {(
        [
          ['code', 'Show source only', CodeXml],
          ['split', 'Show source and model', Columns2],
          ['diagram', 'Show model only', Layers],
        ] as const
      ).map(([value, label, icon]) => (
        <IconButton
          key={value}
          label={label}
          icon={icon}
          aria-pressed={mode === value}
          onClick={() => onMode(value)}
        />
      ))}
    </div>
  );
}
