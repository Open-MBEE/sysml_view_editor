import { readFile } from 'node:fs/promises';
import Type from 'typebox';
import { validator } from '../src/lib/contracts/validation.ts';

const text = Type.String({ minLength: 1 });
const strings = Type.Array(text, { uniqueItems: true });
const ViewSchema = Type.Object(
  {
    id: text,
    engineKind: text,
    app: Type.Union([
      Type.Literal('rendered'),
      Type.Literal('partial'),
      Type.Literal('unavailable'),
    ]),
    nodeNames: Type.Array(Type.String()),
    edgeKinds: Type.Array(text),
    targets: Type.Array(text, { minItems: 1 }),
    gaps: strings,
    notices: strings,
  },
  { additionalProperties: false },
);
const CatalogSchema = Type.Object(
  {
    version: Type.Literal(1),
    examples: Type.Array(
      Type.Object(
        {
          id: Type.String({ pattern: '^[a-z][a-z0-9-]*$' }),
          title: text,
          topics: Type.Array(text, { minItems: 1, uniqueItems: true }),
          files: Type.Array(
            Type.String({ pattern: '^[A-Za-z0-9_-]+\\.sysml$' }),
            { minItems: 1, maxItems: 20, uniqueItems: true },
          ),
          views: Type.Array(ViewSchema, { minItems: 1 }),
        },
        { additionalProperties: false },
      ),
      { minItems: 1 },
    ),
  },
  { additionalProperties: false },
);
const readCatalog = validator(CatalogSchema, 'Invalid example catalog');

export function validateCatalog(input: unknown) {
  const catalog = readCatalog(input);
  const ids = new Set<string>();
  for (const entry of catalog.examples) {
    if (ids.has(entry.id)) throw new Error('Duplicate example ID: ' + entry.id);
    ids.add(entry.id);
    const views = new Set<string>();
    for (const view of entry.views) {
      if (views.has(view.id))
        throw new Error('Duplicate example view: ' + view.id);
      views.add(view.id);
      if ((view.app === 'rendered') !== (view.gaps.length === 0))
        throw new Error(
          'Example support must match its recorded gaps: ' + view.id,
        );
    }
  }
  return catalog;
}

export async function loadCatalog() {
  return validateCatalog(
    JSON.parse(
      await readFile(new URL('./catalog.json', import.meta.url), 'utf8'),
    ),
  );
}
export type Example = Awaited<
  ReturnType<typeof loadCatalog>
>['examples'][number];

export async function loadExample(entry: Example) {
  return Promise.all(
    entry.files.map(async (name) => ({
      name,
      text: await readFile(
        new URL(`./${entry.id}/${name}`, import.meta.url),
        'utf8',
      ),
    })),
  );
}
