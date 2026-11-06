import { expect, it } from 'vitest';
import { attributeLabel } from './attribute-label';
it('formats simple defaults without evaluating expressions or changing complex declarations', () => {
  expect(attributeLabel('attribute capacityWh : Real default = 480.0;')).toBe(
    'capacityWh: Real = 480',
  );
  expect(attributeLabel('attribute reserve : Real default = 20.5;')).toBe(
    'reserve: Real = 20.5',
  );
  const expression = 'attribute capacity : Real default = base * factor;';
  expect(attributeLabel(expression)).toBe(expression);
});
