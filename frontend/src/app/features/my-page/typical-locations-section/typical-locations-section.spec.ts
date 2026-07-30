import { describe, expect, it } from 'vitest';
import { locationFormModel, typicalLocationInput } from '../functions';

describe('TypicalLocationsSection', () => {
  it('normalizes Typical Location input', () => {
    expect(
      typicalLocationInput({ name: ' Home ', details: ' ', timezone: ' Europe/Copenhagen ' }),
    ).toEqual({ name: 'Home', details: null, timezone: 'Europe/Copenhagen' });
  });

  it('uses an available timezone for new locations', () => {
    expect(locationFormModel().timezone).toBeTruthy();
  });
});
