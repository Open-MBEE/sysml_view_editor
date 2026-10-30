import Type from 'typebox';
import { validator } from '$lib/contracts/validation';

export const layoutStorageKey = 'sysml-workbench-layout-v1';
const percentage = (minimum: number, maximum: number) =>
  Type.Number({ minimum, maximum });
export const WorkbenchLayoutSchema = Type.Object(
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
export type WorkbenchLayout = Type.Static<typeof WorkbenchLayoutSchema>;
export const defaultLayout: WorkbenchLayout = {
  version: 1,
  explorer: 17,
  inspector: 19,
  split: 50,
  issues: 24,
  explorerClosed: false,
  inspectorClosed: false,
  issuesClosed: true,
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
export function loadLayout(
  storage: Pick<Storage, 'getItem'>,
  narrow: boolean,
): WorkbenchLayout {
  return (
    parseLayout(storage.getItem(layoutStorageKey)) ?? {
      ...defaultLayout,
      inspectorClosed: narrow,
    }
  );
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
