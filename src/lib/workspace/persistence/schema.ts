import Type from 'typebox';
import { validator } from '$lib/contracts/validation';
import { SourceDocumentsSchema } from '../project/schema';
import { ViewPresentationSchema } from '../views/schema';
export const ProjectBundleSchema = Type.Object(
  {
    format: Type.Literal('sysmlv2-view-project'),
    version: Type.Literal(1),
    name: Type.String({ minLength: 1, maxLength: 120 }),
    documents: SourceDocumentsSchema,
    drafts: SourceDocumentsSchema,
    presentations: Type.Record(Type.String(), ViewPresentationSchema),
  },
  { additionalProperties: false },
);
export const validateProjectBundle = validator(
  ProjectBundleSchema,
  'Select a supported version 1 project; invalid fields or positions',
);
