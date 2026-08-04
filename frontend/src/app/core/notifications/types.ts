/** Resolved router target for a Notification deep link. */
export type NotificationRouteTarget = {
  readonly commands: readonly string[];
  readonly queryParams?: Readonly<Record<string, string>>;
};
