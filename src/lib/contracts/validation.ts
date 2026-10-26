import { Compile } from 'typebox/compile';
import type { Static, TSchema } from 'typebox';
export type ReadonlyData<T> = T extends readonly (infer Item)[]
  ? readonly ReadonlyData<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: ReadonlyData<T[Key]> }
    : T;
/** Validate without defaults, conversion or removal of unknown properties. */
export function validator<const Shape extends TSchema>(
  shape: Shape,
  label: string,
) {
  const compiled = Compile(shape);
  return (value: unknown): ReadonlyData<Static<Shape>> => {
    if (!compiled.Check(value))
      throw new Error(
        label + ': ' + JSON.stringify(compiled.Errors(value).slice(0, 3)),
      );
    return value as ReadonlyData<Static<Shape>>;
  };
}
