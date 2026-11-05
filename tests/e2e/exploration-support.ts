import type { Page } from '@playwright/test';
import { ready, expect } from './support';

export const documents = [
  {
    name: 'model.sysml',
    text: 'package P {\r\n /* 🔧 café */ part def System { part primary : Q::Motor; part standby : Q::Motor; }\r\n part system : System;\r\n}\r\n',
  },
  {
    name: 'other.sysml',
    text: 'package Q { part def Motor; part other : Motor; }\n',
  },
];
export async function noViews(page: Page) {
  await ready(page);
  await page.locator('input[type=file]').setInputFiles(
    documents.map((file) => ({
      name: file.name,
      mimeType: 'text/plain',
      buffer: Buffer.from(file.text),
    })),
  );
  await expect(
    page.getByRole('combobox', { name: 'Exploration scope', exact: true }),
  ).toBeEnabled();
  await expect(
    page
      .getByRole('region', { name: 'Diagram', exact: true })
      .getByRole('group', { name: 'part def System', exact: true }),
  ).toBeVisible();
}

/** Existing assembly model, with no authored views added or source rewritten. */
export async function assemblyExploration(page: Page) {
  const { readFile } = await import('node:fs/promises');
  const text = await readFile(
    new URL('../../examples/assembly/model.sysml', import.meta.url),
    'utf8',
  );
  await ready(page, { split: false });
  await page.locator('input[type=file]').setInputFiles({
    name: 'assembly.sysml',
    mimeType: 'text/plain',
    buffer: Buffer.from(text),
  });
  await expect(
    page.getByRole('group', { name: 'package Assembly', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Exploration scope', exact: true }),
  ).toBeEnabled();
  return [{ name: 'assembly.sysml', text }];
}
