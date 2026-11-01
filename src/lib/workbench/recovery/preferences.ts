/** Only the switch is a preference; source/project data stays in IndexedDB. */
export const recoveryPreferenceKey = 'sysml-view-recovery-enabled-v1';
export function readRecoveryEnabled(
  storage: Pick<Storage, 'getItem'>,
): boolean {
  return storage.getItem(recoveryPreferenceKey) !== 'false';
}
export function writeRecoveryEnabled(
  storage: Pick<Storage, 'setItem'>,
  enabled: boolean,
): void {
  storage.setItem(recoveryPreferenceKey, String(enabled));
}
