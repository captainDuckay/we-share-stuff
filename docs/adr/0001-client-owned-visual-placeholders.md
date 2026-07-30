# Keep fallback icons in clients

Items and Sharing Groups no longer persist or expose fallback icons. Item Photos are optional, a Sharing Group may have one optional Sharing Group Photo, and clients choose their own placeholders when no photo exists; the Angular client currently uses `tools-power-drill` for Items and `group` for Sharing Groups. This removes the database `visual_icon` columns, writable `visualIcon` fields, and generic `visual` API union rather than treating presentation defaults as domain data.

Compact Item responses expose the earliest uploaded Item Photo as `photoUrl`, or `null` when there is no photo. Removing an Item's final photo does not affect share readiness or existing sharing. This supersedes the Item Photo readiness requirement recorded in `docs/decision-records/0001-domain-grilling.md`.
