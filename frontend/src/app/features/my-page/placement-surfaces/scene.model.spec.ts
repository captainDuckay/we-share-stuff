import {
  contentBoundsOf,
  formatMm,
  isLabelTaken,
  nextUniqueLabel,
  roundMm,
  SceneSurface,
} from './scene.model';

const emptySurface = (id = 's1'): SceneSurface => ({
  id,
  name: 'Wall',
  slots: [],
  structures: [],
});

describe('placement surface scene helpers', () => {
  it('returns null content bounds for empty surface', () => {
    expect(contentBoundsOf(emptySurface())).toBeNull();
  });

  it('derives content bounds from slots and structure', () => {
    const surface: SceneSurface = {
      id: 's1',
      name: 'Wall',
      slots: [
        {
          kind: 'slot',
          id: 'a',
          label: 'A',
          x: 100,
          y: 50,
          width: 40,
          height: 20,
        },
      ],
      structures: [
        { kind: 'structure-rect', id: 'r', x: -20, y: -10, width: 30, height: 15 },
        {
          kind: 'structure-line',
          id: 'l',
          points: [
            { x: 200, y: 5 },
            { x: 250, y: 80 },
          ],
        },
      ],
    };
    expect(contentBoundsOf(surface)).toEqual({
      minX: -20,
      minY: -10,
      maxX: 250,
      maxY: 80,
      width: 270,
      height: 90,
    });
  });

  it('detects case-insensitive label collisions across surfaces', () => {
    const surfaces = [
      {
        slots: [{ id: '1', label: 'E27' }],
      },
      {
        slots: [{ id: '2', label: 'Top left' }],
      },
    ];
    expect(isLabelTaken(surfaces, 'e27')).toBe(true);
    expect(isLabelTaken(surfaces, 'e27', '1')).toBe(false);
    expect(isLabelTaken(surfaces, 'Other')).toBe(false);
  });

  it('suggests unique slot labels', () => {
    const surfaces = [{ slots: [{ id: '1', label: 'Slot' }] }];
    expect(nextUniqueLabel(surfaces, 'Slot')).toBe('Slot 2');
  });

  it('rounds millimetres to whole units without float debris', () => {
    expect(roundMm(-12.489883422851562)).toBe(-12);
    expect(roundMm(106.73976135253906)).toBe(107);
    expect(formatMm(-155.1619873046875)).toBe('-155');
  });
});
