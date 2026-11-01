import Type from 'typebox';
import { validator } from '$lib/contracts/validation';
import {
  readProject,
  serializeProject,
  type ProjectBundle,
} from '$lib/workspace/persistence';

const validateEnvelope = validator(
  Type.Object(
    {
      format: Type.Literal('sysml-view-recovery'),
      version: Type.Literal(1),
      savedAt: Type.Integer({ minimum: 0, maximum: 8640000000000000 }),
      project: Type.String(),
      activeFile: Type.Union([Type.String({ maxLength: 1024 }), Type.Null()]),
      activeView: Type.Union([Type.String({ maxLength: 1024 }), Type.Null()]),
    },
    { additionalProperties: false },
  ),
  'Unsupported or invalid local recovery',
);

export interface RecoveryEntry {
  readonly project: ProjectBundle;
  readonly savedAt: number;
  readonly activeFile: string | null;
  readonly activeView: string | null;
}

export function readRecovery(raw: string): RecoveryEntry {
  // Bound parsing before allocating a second copy of a potentially large bundle.
  if (raw.length > 50 * 1024 * 1024)
    throw new Error('Local recovery exceeds 50 MiB.');
  const envelope = validateEnvelope(JSON.parse(raw));
  const project = readProject(envelope.project);
  return {
    project,
    savedAt: envelope.savedAt,
    activeFile: project.drafts.some((file) => file.name === envelope.activeFile)
      ? envelope.activeFile
      : null,
    activeView: envelope.activeView,
  };
}

export function serializeRecovery(entry: RecoveryEntry): string {
  const raw = JSON.stringify({
    format: 'sysml-view-recovery',
    version: 1,
    savedAt: entry.savedAt,
    project: serializeProject(entry.project),
    activeFile: entry.activeFile,
    activeView: entry.activeView,
  });
  readRecovery(raw);
  return raw;
}
