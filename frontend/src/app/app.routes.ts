import { Routes } from '@angular/router';
import { authGuard } from './core/routing/auth.guard';
import { AuthPageComponent } from './features/auth/auth-page/auth-page.component';
import { BrowsePageComponent } from './features/sharing-roadmap/browse-page/browse-page.component';
import { MyReservationsPageComponent } from './features/sharing-roadmap/my-reservations-page/my-reservations-page.component';
import { MyStuffPageComponent } from './features/sharing-roadmap/my-stuff-page/my-stuff-page.component';
import { ShareToolPageComponent } from './features/sharing-roadmap/share-tool-page/share-tool-page.component';
import { SharingGroupPageComponent } from './features/sharing-roadmap/sharing-group-page/sharing-group-page.component';
import { SharingGroupsPageComponent } from './features/sharing-roadmap/sharing-groups-page/sharing-groups-page.component';
import { SharingPageComponent } from './features/sharing-roadmap/sharing-page/sharing-page.component';
import { sharedItemDetailPageResolver } from './features/sharing-roadmap/shared-item-detail-page/shared-item-detail-page.resolver';

export const routes: Routes = [
  { path: 'sign-in', component: AuthPageComponent, data: { mode: 'sign-in' } },
  { path: 'register', component: AuthPageComponent, data: { mode: 'register' } },
  { path: 'home', component: SharingPageComponent, canActivate: [authGuard] },
  { path: 'browse', component: BrowsePageComponent, canActivate: [authGuard] },
  { path: 'share-a-tool', component: ShareToolPageComponent, canActivate: [authGuard] },
  { path: 'my-stuff', component: MyStuffPageComponent, canActivate: [authGuard] },
  {
    path: 'my-page',
    loadComponent: () => import('./features/my-page/my-page/my-page').then(({ MyPage }) => MyPage),
    canActivate: [authGuard],
    title: 'My page',
  },
  { path: 'reservations', component: MyReservationsPageComponent, canActivate: [authGuard] },
  { path: 'sharing-groups', component: SharingGroupsPageComponent, canActivate: [authGuard] },
  {
    path: 'sharing-groups/:groupId',
    component: SharingGroupPageComponent,
    canActivate: [authGuard],
  },
  {
    path: 'shared-items/:itemId',
    loadComponent: () =>
      import('./features/sharing-roadmap/shared-item-detail-page/shared-item-detail-page.component').then(
        ({ SharedItemDetailPageComponent }) => SharedItemDetailPageComponent,
      ),
    canActivate: [authGuard],
    resolve: { detail: sharedItemDetailPageResolver },
  },
  { path: 'sharing', redirectTo: 'home' },
  { path: 'browse-shared-items', redirectTo: 'browse' },
  // PROTOTYPE ONLY (wayfinder #7) — throwaway; keep off product navigation
  {
    path: 'prototype/placement-surface-editor',
    loadComponent: () =>
      import('./features/prototype/placement-surface-editor/placement-surface-editor-prototype.page').then(
        ({ PlacementSurfaceEditorPrototypePage }) => PlacementSurfaceEditorPrototypePage,
      ),
    title: 'PROTOTYPE · Placement Surface editor',
  },
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: '**', redirectTo: 'home' },
];
