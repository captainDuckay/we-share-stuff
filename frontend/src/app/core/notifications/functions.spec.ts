import { describe, expect, it } from 'vitest';
import { resolveDeepLink } from './functions';

describe('resolveDeepLink', () => {
  it('maps home to /home without query params', () => {
    expect(resolveDeepLink({ surface: 'home' })).toEqual({
      commands: ['/home'],
    });
  });

  it('maps sharing_group with id to the group path', () => {
    expect(
      resolveDeepLink({ surface: 'sharing_group', sharingGroupId: 'g1' }),
    ).toEqual({
      commands: ['/sharing-groups', 'g1'],
    });
  });

  it('maps sharing_group without id to the groups list', () => {
    expect(resolveDeepLink({ surface: 'sharing_group' })).toEqual({
      commands: ['/sharing-groups'],
    });
  });

  it('maps reservations with reservationId to query param for scroll targeting', () => {
    expect(
      resolveDeepLink({ surface: 'reservations', reservationId: 'r1' }),
    ).toEqual({
      commands: ['/reservations'],
      queryParams: { reservationId: 'r1' },
    });
  });

  it('maps reservations without reservationId to path only', () => {
    expect(resolveDeepLink({ surface: 'reservations' })).toEqual({
      commands: ['/reservations'],
    });
  });

  it('maps my_stuff with tab and reservationId for Approvals scroll targeting', () => {
    expect(
      resolveDeepLink({
        surface: 'my_stuff',
        tab: 'approvals',
        reservationId: 'r1',
      }),
    ).toEqual({
      commands: ['/my-stuff'],
      queryParams: { tab: 'approvals', reservationId: 'r1' },
    });
  });

  it('maps my_stuff with tab only', () => {
    expect(
      resolveDeepLink({
        surface: 'my_stuff',
        tab: 'approvals',
      }),
    ).toEqual({
      commands: ['/my-stuff'],
      queryParams: { tab: 'approvals' },
    });
  });

  it('maps my_stuff without tab to path only', () => {
    expect(resolveDeepLink({ surface: 'my_stuff' })).toEqual({
      commands: ['/my-stuff'],
    });
  });

  it('returns null for unmapped surfaces', () => {
    expect(resolveDeepLink({ surface: 'unknown_surface' })).toBeNull();
  });
});
