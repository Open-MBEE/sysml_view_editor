import Type from 'typebox';
import { validator } from '$lib/contracts/validation';

export const layoutStorageKey = 'sysml-workbench-layout-v2';
const percentage = (minimum: number, maximum: number) =>
  Type.Number({ minimum, maximum });
export const WorkbenchLayoutSchema = Type.Object(
  {
    version: Type.Literal(2),
    explorer: percentage(5, 45),
    source: percentage(10, 65),
    inspection: percentage(12, 60),
    explorerClosed: Type.Boolean(),
    sourceClosed: Type.Boolean(),
    inspectionClosed: Type.Boolean(),
    inspectionTab: Type.Union([
      Type.Literal('properties'),
      Type.Literal('relationships'),
      Type.Literal('issues'),
    ]),
  },
  { additionalProperties: false },
);
export type WorkbenchLayout = Type.Static<typeof WorkbenchLayoutSchema>;
export const defaultLayout: WorkbenchLayout = {
  version: 2,
  explorer: 18,
  source: 32,
  inspection: 25,
  explorerClosed: false,
  sourceClosed: true,
  inspectionClosed: true,
  inspectionTab: 'properties',
};
const readLayout = validator(WorkbenchLayoutSchema, 'Invalid workspace layout');
export function parseLayout(raw: string | null): WorkbenchLayout | undefined {
  if (!raw || raw.length > 2048) return;
  try {
    return readLayout(JSON.parse(raw));
  } catch {
    return;
  }
}
const legacySchema = Type.Object(
  {
    version: Type.Literal(1),
    explorer: percentage(5, 45),
    inspector: percentage(5, 45),
    split: percentage(10, 90),
    issues: percentage(12, 60),
    explorerClosed: Type.Boolean(),
    inspectorClosed: Type.Boolean(),
    issuesClosed: Type.Boolean(),
  },
  { additionalProperties: false },
);
const readLegacy = validator(legacySchema, 'Invalid legacy workspace layout');
export function loadLayout(
  storage: Pick<Storage, 'getItem'>,
  _narrow: boolean,
): WorkbenchLayout {
  const current = parseLayout(storage.getItem(layoutStorageKey));
  if (current) return current;
  const raw = storage.getItem('sysml-workbench-layout-v1');
  if (raw && raw.length <= 2048) {
    try {
      const old = readLegacy(JSON.parse(raw));
      return {
        ...defaultLayout,
        explorer: old.explorer,
        explorerClosed: old.explorerClosed,
        source: Math.max(10, Math.min(65, old.split)),
        inspection: old.issues,
        inspectionClosed: old.inspectorClosed && old.issuesClosed,
        inspectionTab: old.issuesClosed ? 'properties' : 'issues',
      };
    } catch {
      /* Invalid preferences never prevent opening a project. */
    }
  }
  return { ...defaultLayout };
}
export function saveLayout(
  storage: Pick<Storage, 'setItem'>,
  value: WorkbenchLayout,
): boolean {
  try {
    storage.setItem(layoutStorageKey, JSON.stringify(readLayout(value)));
    return true;
  } catch {
    return false;
  }
}
