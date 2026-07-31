import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  PlacementSlotEnvelope,
  PlacementSlotInput,
  PlacementSlotPatch,
  PlacementSurfaceEnvelope,
  PlacementSurfaceInput,
  PlacementSurfacesEnvelope,
  StructuralDrawingEnvelope,
  StructuralDrawingInput,
  StructuralDrawingPatch,
} from './model';

const base = (locationId: string): string =>
  `/api/typical-locations/${encodeURIComponent(locationId)}/placement-surfaces`;

@Injectable({ providedIn: 'root' })
export class PlacementSurfacesApi {
  readonly #http = inject(HttpClient);

  list = (locationId: string): Promise<PlacementSurfacesEnvelope> =>
    firstValueFrom(this.#http.get<PlacementSurfacesEnvelope>(base(locationId)));

  create = (locationId: string, input: PlacementSurfaceInput): Promise<PlacementSurfaceEnvelope> =>
    firstValueFrom(this.#http.post<PlacementSurfaceEnvelope>(base(locationId), input));

  get = (locationId: string, surfaceId: string): Promise<PlacementSurfaceEnvelope> =>
    firstValueFrom(
      this.#http.get<PlacementSurfaceEnvelope>(
        `${base(locationId)}/${encodeURIComponent(surfaceId)}`,
      ),
    );

  update = (
    locationId: string,
    surfaceId: string,
    input: Partial<PlacementSurfaceInput>,
  ): Promise<PlacementSurfaceEnvelope> =>
    firstValueFrom(
      this.#http.patch<PlacementSurfaceEnvelope>(
        `${base(locationId)}/${encodeURIComponent(surfaceId)}`,
        input,
      ),
    );

  remove = (locationId: string, surfaceId: string): Promise<void> =>
    firstValueFrom(
      this.#http.delete<void>(`${base(locationId)}/${encodeURIComponent(surfaceId)}`),
    );

  createSlot = (
    locationId: string,
    surfaceId: string,
    input: PlacementSlotInput,
  ): Promise<PlacementSlotEnvelope> =>
    firstValueFrom(
      this.#http.post<PlacementSlotEnvelope>(
        `${base(locationId)}/${encodeURIComponent(surfaceId)}/slots`,
        input,
      ),
    );

  updateSlot = (
    locationId: string,
    surfaceId: string,
    slotId: string,
    input: PlacementSlotPatch,
  ): Promise<PlacementSlotEnvelope> =>
    firstValueFrom(
      this.#http.patch<PlacementSlotEnvelope>(
        `${base(locationId)}/${encodeURIComponent(surfaceId)}/slots/${encodeURIComponent(slotId)}`,
        input,
      ),
    );

  removeSlot = (locationId: string, surfaceId: string, slotId: string): Promise<void> =>
    firstValueFrom(
      this.#http.delete<void>(
        `${base(locationId)}/${encodeURIComponent(surfaceId)}/slots/${encodeURIComponent(slotId)}`,
      ),
    );

  createDrawing = (
    locationId: string,
    surfaceId: string,
    input: StructuralDrawingInput,
  ): Promise<StructuralDrawingEnvelope> =>
    firstValueFrom(
      this.#http.post<StructuralDrawingEnvelope>(
        `${base(locationId)}/${encodeURIComponent(surfaceId)}/structural-drawings`,
        input,
      ),
    );

  updateDrawing = (
    locationId: string,
    surfaceId: string,
    drawingId: string,
    input: StructuralDrawingPatch,
  ): Promise<StructuralDrawingEnvelope> =>
    firstValueFrom(
      this.#http.patch<StructuralDrawingEnvelope>(
        `${base(locationId)}/${encodeURIComponent(surfaceId)}/structural-drawings/${encodeURIComponent(drawingId)}`,
        input,
      ),
    );

  removeDrawing = (locationId: string, surfaceId: string, drawingId: string): Promise<void> =>
    firstValueFrom(
      this.#http.delete<void>(
        `${base(locationId)}/${encodeURIComponent(surfaceId)}/structural-drawings/${encodeURIComponent(drawingId)}`,
      ),
    );
}
