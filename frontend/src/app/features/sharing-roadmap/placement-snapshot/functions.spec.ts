import { describe, expect, it } from 'vitest';
import type { StructuredPlacementSnapshot } from '../../../core/api/model';
import { sceneFromStructuredSnapshot } from './functions';

const sampleSnapshot = (): StructuredPlacementSnapshot => ({
  surfaceName: 'Garage wall',
  slotLabel: 'Shelf A',
  note: 'behind paint',
  targetSlot: {
    id: 'target',
    label: 'Shelf A',
    x: 10,
    y: 20,
    width: 400,
    height: 300,
  },
  otherSlots: [
    {
      id: 'other',
      label: 'Shelf B',
      x: 500,
      y: 20,
      width: 200,
      height: 150,
    },
  ],
  structuralDrawings: [
    {
      id: 'struct-rect',
      kind: 'rect',
      x: 0,
      y: 0,
      width: 800,
      height: 50,
      points: null,
    },
    {
      id: 'struct-line',
      kind: 'polyline',
      x: null,
      y: null,
      width: null,
      height: null,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ],
    },
  ],
});

describe('sceneFromStructuredSnapshot', () => {
  it('maps target and other slots plus structure without inventing co-located items', () => {
    const scene = sceneFromStructuredSnapshot(sampleSnapshot());
    expect(scene.name).toBe('Garage wall');
    expect(scene.slots).toEqual([
      {
        kind: 'slot',
        id: 'target',
        label: 'Shelf A',
        x: 10,
        y: 20,
        width: 400,
        height: 300,
      },
      {
        kind: 'slot',
        id: 'other',
        label: 'Shelf B',
        x: 500,
        y: 20,
        width: 200,
        height: 150,
      },
    ]);
    expect(scene.structures).toEqual([
      {
        kind: 'structure-rect',
        id: 'struct-rect',
        x: 0,
        y: 0,
        width: 800,
        height: 50,
      },
      {
        kind: 'structure-line',
        id: 'struct-line',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
      },
    ]);
  });
});
