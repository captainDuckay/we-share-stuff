# Decision Record 0002: Shared Item discovery experience

This record captures the decisions from the grilling session about how logged-in Users find Shared Items and act on Reservation Requests. The logged-in landing screen is **Home**, focused on the User's Sharing Groups and attention items rather than private Inventory. From Home, Users can open Sharing Groups as community/activity pages and can also use a global **Browse shared items** entry point to discover Shared Items visible to them across all Sharing Groups.

## Status

Accepted.

## Date

2026-07-12

## Decisions

### 1. What is the logged-in landing screen?

**Decision:** The logged-in landing screen is **Home**.

**Rationale:** Home should mix the User's Sharing Groups with attention items such as Invitations and Reservation activity. It is not primarily an Inventory page and not only an item-discovery page.

### 2. What is the primary action from a Sharing Group on Home?

**Decision:** Opening a Sharing Group leads to a community page for that Sharing Group, not directly to an item list.

**Rationale:** A Sharing Group is a mutual relationship space. Its page should support Members, Invitations/settings/actions, and activity/attention, not imply that the Sharing Group owns Items.

### 3. How do Users find Items to borrow?

**Decision:** Discovery has two entry points: group-scoped discovery from a Sharing Group page, and global discovery from Home through **Browse shared items**.

**Rationale:** Users may browse within a specific relationship space, but they may also want one combined view of all Shared Items visible to them.

### 4. What is the primary unit in global discovery?

**Decision:** Global discovery is Shared Item-first. It shows one combined list of Shared Items visible to the User.

**Rationale:** The User's intent is to browse available shared things, not necessarily to choose a Sharing Group first.

### 5. How are Items shared through multiple Sharing Groups shown?

**Decision:** The global Shared Item list deduplicates by Item and shows the Sharing Groups through which the User can see the Item.

**Rationale:** If the same Item is shared with the User through multiple Sharing Groups, showing duplicates would make discovery noisy and would misrepresent the underlying Item.

### 6. Are the User's own Shared Items shown in global discovery?

**Decision:** Yes. Global discovery shows all Shared Items visible to the User, including their own Items, clearly marked as theirs.

**Rationale:** The view is **Browse shared items**, not strictly “borrow from others.” Showing the User's own shared Items helps them understand what is visible in their sharing network.

### 7. What appears in the first-version Shared Item list?

**Decision:** Each Shared Item list entry should show Item name, photo thumbnail, owning User, and the Sharing Groups through which the viewing User can see it.

**Rationale:** This is enough context for recognition and trust before opening details. Typical Location is not required in the list.

### 8. What appears on Shared Item detail?

**Decision:** Shared Item detail shows the full Typical Location before Reservation acceptance. Typical Placement remains hidden until acceptance.

**Rationale:** This preserves the existing sharing rule: sharing an Item consents to revealing full Typical Location to Members of the Sharing Groups where the Item is shared, while keeping precise placement private until borrowing is accepted.

### 9. What is the primary action on Shared Item detail?

**Decision:** The primary action is **Request to borrow** with a date-time range.

**Rationale:** The detail page should support borrowing intent, not just passive browsing.

### 10. What does Request to borrow create?

**Decision:** Request to borrow creates a **Reservation Request** that the owning User must accept.

**Rationale:** A request is not a hold and not an accepted borrowing claim. Only owner acceptance creates an Accepted Reservation.

### 11. Do Reservation Requests block conflicts?

**Decision:** No. Only an Accepted Reservation blocks conflicting borrowing claims.

**Rationale:** Multiple Users may request overlapping date-time ranges. The owning User can choose which request to accept.

### 12. Where do Reservation Requests appear?

**Decision:** Reservation Requests appear on Home as main attention items, on the relevant Sharing Group page as group-scoped activity/attention, and on the owned Item detail page as item-specific context.

**Rationale:** Home is the main attention hub, but group and item pages need local context.

### 13. Is a Reservation Request associated with a Sharing Group?

**Decision:** No. A Reservation Request is between the requesting User, the owning User, and the Item.

**Rationale:** Sharing Groups explain why the requesting User could see the Shared Item, but the borrowing claim itself is not made through a specific Sharing Group.

### 14. What happens when an Item is unshared after a Reservation Request exists?

**Decision:** Existing Reservation Requests remain visible and actionable. The owning User may accept an existing Reservation Request even if the Item is no longer shared with the requesting User.

**Rationale:** Visibility at request time is enough to keep the request valid. Unsharing stops new discovery and requestability; it does not erase already-created requests.

### 15. What happens to overlapping pending requests after one request is accepted?

**Decision:** Overlapping pending Reservation Requests remain pending, but they cannot be accepted while they conflict with an Accepted Reservation unless their requested time changes.

**Rationale:** Acceptance creates the conflict, but the system should not automatically decline other pending requests.

### 16. What lifecycle does a Reservation Request have?

**Decision:** Reservation Requests have explicit statuses: pending, accepted, declined, and withdrawn.

**Rationale:** The lifecycle needs to distinguish owner approval, owner rejection, and requester withdrawal without treating every request as an accepted borrowing claim.

### 17. Is an Accepted Reservation separate from the Reservation Request?

**Decision:** No. An Accepted Reservation is the same Reservation Request after its status changes to accepted.

**Rationale:** The domain should not create a second borrowing claim beside the original request. Acceptance changes the request's state.

### 18. Can Reservation Requests be changed?

**Decision:** Yes. Either the requesting User or the owning User may make a **Reservation Change Proposal** for the date-time range. The other party must approve the proposal before the change takes effect.

**Rationale:** Date-time changes affect both parties, so they should not be unilateral.

### 19. Can accepted Reservation Requests have proposed changes?

**Decision:** Yes. A Reservation Change Proposal may be made after the Reservation Request is already accepted.

**Rationale:** Real borrowing arrangements may need rescheduling without withdrawing and recreating the request.

### 20. What happens to an accepted time while a Reservation Change Proposal is pending?

**Decision:** The existing accepted time remains valid until the Reservation Change Proposal is approved.

**Rationale:** A pending proposal should not suspend or alter the current agreement.

### 21. Can multiple Reservation Change Proposals be pending at once?

**Decision:** No. A Reservation Request may have only one pending Reservation Change Proposal at a time.

**Rationale:** This avoids branching negotiation state.

### 22. What happens when a Reservation Change Proposal is rejected?

**Decision:** The original Reservation Request remains unchanged.

**Rationale:** Rejecting the proposed change should not reject or withdraw the underlying request.

### 23. Can a pending Reservation Request be accepted while a change proposal is pending?

**Decision:** No. A pending Reservation Change Proposal must be approved or rejected before the owning User can accept the Reservation Request.

**Rationale:** Acceptance should not happen while the date-time terms are ambiguous.

### 24. Can a Reservation Request be ended while a change proposal is pending?

**Decision:** Yes. Withdrawal or cancellation of the whole Reservation Request can still happen while a Reservation Change Proposal is pending.

**Rationale:** A pending proposed change should not trap either party in the arrangement.

### 25. Do accepted Reservation Requests have cancellation?

**Decision:** Yes. Add `cancelled` as the status for an accepted Reservation Request ended by either party.

**Rationale:** Pre-acceptance endings are `declined` by the owner or `withdrawn` by the requester. After acceptance, the borrowing agreement needs a distinct ended state.

### 26. Do cancelled Accepted Reservations block conflicts?

**Decision:** No. A cancelled Accepted Reservation no longer blocks conflicting Reservation Requests.

**Rationale:** Once cancelled, the date-time range should become requestable again.

### 27. Does Typical Placement remain visible after cancellation?

**Decision:** No. Typical Placement is hidden again after an Accepted Reservation is cancelled.

**Rationale:** Acceptance grants access to precise placement for the active borrowing arrangement. When that arrangement is cancelled, the extra visibility should end.

### 28. Is completion or current borrowing modeled as a separate status?

**Decision:** No. An accepted Reservation Request remains accepted after its end time, and “currently borrowed” is derived from an accepted Reservation Request whose date-time range includes now.

**Rationale:** Pickup, return, and completion lifecycle remain deferred. Time-derived labels are enough for now.

### 29. Where are availability labels shown?

**Decision:** Shared Item detail may show simple derived availability labels such as available now, currently borrowed, or reserved later. The first-version Shared Item lists do not show availability labels.

**Rationale:** Lists should stay lightweight, while detail pages can provide enough context before Request to borrow.

### 30. What fields appear in group-scoped Shared Item lists?

**Decision:** A group-scoped Shared Item list shows Item name, photo thumbnail, and owning User. It omits Sharing Group context because the current Sharing Group page already supplies that context.

**Rationale:** Group-scoped discovery should not repeat obvious context.

### 31. What appears on Home Sharing Group cards?

**Decision:** Home Sharing Group cards show the Sharing Group name, initials for all Members, and the number of Shared Items visible to the User in that Sharing Group. Cards show up to 6 Member initials, then `+N` for the remaining Members.

**Rationale:** The card should communicate relationship context and visible sharing volume without implying access to hidden Items. The UI should say Shared Items, not shared tools, unless the product later narrows to tools only.

### 32. What attention items appear on Home?

**Decision:** Home attention includes Invitations, Reservation Requests, and Reservation Change Proposals. Items are prioritized by urgency/actionability rather than simply grouped by type or chronological order.

**Rationale:** Home is the coordination hub. The most important thing is whether the User needs to act.

### 33. How are actionable and informational attention items handled?

**Decision:** Attention items may be actionable or informational. Informational items stay until manually dismissed. Actionable items cannot be dismissed without resolving the underlying Invitation, Reservation Request, or Reservation Change Proposal.

**Rationale:** Users should be able to clear read-only updates, but unresolved decisions should not disappear from the main coordination surface.

### 34. How does attention work on Sharing Group pages?

**Decision:** Sharing Group pages use the same priority/actionable/informational attention model as Home, scoped to that Sharing Group.

**Rationale:** Group pages need local coordination context while preserving the same mental model as Home.

### 35. How is the Sharing Group page structured?

**Decision:** Attention appears first as banner warnings. Below that, the page uses an 80/20 two-column layout: Shared Items in the main column and community overview in the secondary column.

**Rationale:** The page should surface urgent coordination first, then prioritize item discovery while keeping community context nearby.

### 36. What appears in the Sharing Group community overview?

**Decision:** The community overview contains Members and Invitations.

**Rationale:** These are the group relationship elements needed beside item discovery without turning the page into inventory management.

### 37. Can Users share Items into a Sharing Group from the Sharing Group page?

**Decision:** No. Sharing own Items into a Sharing Group happens from Inventory.

**Rationale:** The Sharing Group page is for discovery and community context; Inventory remains the management surface for the User's own Items.

### 38. Are the current User's own Shared Items shown on a Sharing Group page?

**Decision:** Yes. Group-scoped Shared Item lists include the current User's own Shared Items, marked as theirs.

**Rationale:** This keeps group-scoped discovery consistent with global Browse shared items and helps the User understand what they have shared into the group.

### 39. Does Shared Item detail preserve Sharing Group context?

**Decision:** No. Shared Item detail is global and does not preserve the Sharing Group context it was opened from.

**Rationale:** Reservation Requests are not associated with a Sharing Group. The detail page is about the Item and the Users involved.

### 40. Does Shared Item detail show Sharing Groups through which the Item is visible?

**Decision:** Yes. Shared Item detail lists all Sharing Groups through which the viewing User can see the Item.

**Rationale:** Visibility context is useful, but it does not make the detail page group-scoped.

### 41. What primary action appears for the User's own Shared Item detail?

**Decision:** There is no Request to borrow primary action for the User's own Shared Item, and no manage/edit Inventory link for now.

**Rationale:** The Shared Item detail surface remains view-only for owned Items and does not become an Inventory management shortcut.

### 42. What owner information appears on Shared Item detail?

**Decision:** Shared Item detail shows the owning User's name/display name only. Contact information and User detail pages are deferred as a later seam.

**Rationale:** The first version needs ownership context, not a broader contact/profile model.

### 43. What fields are required to create a Reservation Request?

**Decision:** The Reservation Request form requires only start date-time and end date-time.

**Rationale:** Messages, pickup notes, and free-text negotiation are out of scope for the first version.

### 44. How is conflict validation handled when creating Reservation Requests?

**Decision:** Submission is blocked if the requested date-time range conflicts with an existing Accepted Reservation. Pending overlapping Reservation Requests do not block submission.

**Rationale:** Only Accepted Reservations reserve the Item.

### 45. What happens when a pending Reservation Request becomes conflicted later?

**Decision:** The Reservation Request remains pending, but can no longer be accepted unless its dates change. The UI should visibly show that it conflicts with an Accepted Reservation and suggest proposing new dates.

**Rationale:** A later Accepted Reservation should not erase existing pending requests, but it must prevent conflicting acceptance.

### 46. Is there a domain term for a pending request that now conflicts?

**Decision:** No. It is simply a Reservation Request that conflicts with an Accepted Reservation.

**Rationale:** The state is useful to display but does not need a canonical domain term yet.

### 47. How is conflict validation handled for Reservation Change Proposals?

**Decision:** Reservation Change Proposals are blocked if the proposed date-time range conflicts with an existing Accepted Reservation. When changing an already accepted Reservation Request, its own current accepted range does not count as a conflict against itself.

**Rationale:** Proposed changes should not create impossible accepted schedules.

### 48. What happens to Typical Placement visibility during changes to accepted Reservation Requests?

**Decision:** Typical Placement remains visible while a Reservation Change Proposal is pending and after it is approved, because the Reservation Request stays accepted.

**Rationale:** The active accepted borrowing arrangement remains in force until changed or cancelled.

### 49. What happens when a change proposal is approved for a pending Reservation Request?

**Decision:** The requested date-time range is updated, but the Reservation Request remains pending. Owner acceptance is still separate.

**Rationale:** Approving proposed dates is not the same as accepting the borrow request.

### 50. Can a Reservation Request end while the other party's change proposal is pending?

**Decision:** Yes. The requesting User may withdraw, and the owning User may decline, a pending Reservation Request even while a Reservation Change Proposal is pending.

**Rationale:** A proposed change should not prevent either party from ending an unaccepted request.

### 51. What happens to pending Reservation Change Proposals when the Reservation Request ends?

**Decision:** If a Reservation Request is withdrawn, declined, or cancelled, any pending Reservation Change Proposal becomes `void`.

**Rationale:** The proposal cannot take effect once the underlying request has ended.

### 52. What statuses does a Reservation Change Proposal have?

**Decision:** Reservation Change Proposal statuses are `pending`, `approved`, `rejected`, and `void`.

**Rationale:** These statuses distinguish active proposals, accepted changes, rejected changes, and proposals invalidated because the underlying Reservation Request ended.

### 53. Are Reservation Change Proposals kept as history?

**Decision:** Yes. All Reservation Change Proposals remain visible as history/audit, including approved, rejected, and void proposals.

**Rationale:** Proposed changes are part of the negotiation history between the two involved Users.

### 54. Who can see Reservation Requests and Reservation Change Proposal history?

**Decision:** Only the requesting User and owning User can see Reservation Requests and Reservation Change Proposal history.

**Rationale:** Borrowing negotiation is private between the two involved Users.

### 55. What reservation information can other Members see?

**Decision:** Other Members can see exact current and future blocked date-time ranges for Accepted Reservations on Shared Item detail, but not who requested them or any request/proposal history. Cancelled and past Accepted Reservations do not appear in blocked ranges.

**Rationale:** Members need enough information to avoid unavailable times, without exposing private borrowing history.

### 56. Does Shared Item detail show availability labels and blocked ranges?

**Decision:** Yes. Shared Item detail shows both simple derived availability labels and exact current/future blocked ranges or a reservation calendar. Global and group-scoped Shared Item lists remain lightweight and do not show availability labels or blocked ranges.

**Rationale:** Detail pages support borrowing decisions; lists should remain scannable.

### 57. Can Reservation Requests or Reservation Change Proposals use past date-time ranges?

**Decision:** No. Reservation Requests and Reservation Change Proposals cannot use date-time ranges in the past.

**Rationale:** The product does not support historical correction or retroactive borrowing claims.

### 58. Which timezone is used for reservation date-times?

**Decision:** Blocked ranges, Reservation Request date-time fields, and Reservation Change Proposal date-time fields use the Typical Location timezone. Sharing and requesting require a Typical Location with a timezone.

**Rationale:** Reservation time is location-local. The Typical Location timezone owns the meaning of reservation start and end times.

### 59. Is Browse shared items available with zero Sharing Groups?

**Decision:** Yes. Browse shared items remains available even when the User belongs to zero Sharing Groups, but shows an empty state explaining that the User needs to join or create a Sharing Group.

**Rationale:** The entry point can remain stable while clearly explaining why there are no Shared Items to browse.

### 60. What does Home show for a User with zero Sharing Groups?

**Decision:** If a User belongs to zero Sharing Groups, Home primarily prompts them to build their Inventory first. If they also have pending Invitations, those Invitations appear as actionable attention above the Inventory prompt.

**Rationale:** Private Inventory remains the foundation for future sharing, while actionable Invitations should not be hidden.

### 61. What does Home show for a User with Sharing Groups but zero Items?

**Decision:** If a User belongs to Sharing Groups but has zero Items in Inventory, Home shows a secondary prompt to add Items.

**Rationale:** Home remains focused on groups and attention, but can still nudge the User toward contributing Items.

### 62. What empty state does Browse shared items show when there are no visible Shared Items?

**Decision:** Browse shared items explains that no Items have been shared yet.

**Rationale:** Sharing management belongs in Inventory, so this view should not become the primary prompt to share owned Items.

### 63. What empty state does a Sharing Group page show when there are no Shared Items?

**Decision:** The Sharing Group page's Shared Items section explains that no Items have been shared yet.

**Rationale:** The Sharing Group page remains for discovery and community context, not for sharing owned Items from Inventory.

### 64. Are Sharing Groups with zero visible Shared Items shown on Home?

**Decision:** Yes. Home shows Sharing Groups even when they have zero visible Shared Items.

**Rationale:** A Sharing Group is a relationship space, not just a container of visible Items.

### 65. What does the Sharing Group card Shared Item count include?

**Decision:** The Sharing Group card count includes all Shared Items visible to the User in that Sharing Group, including Items that are currently not requestable because of Accepted Reservations.

**Rationale:** The count communicates visible shared inventory volume, not current requestability.

### 66. Does Home show a global Browse shared items count?

**Decision:** Yes. Home's Browse shared items entry point can show a count of all Shared Items visible to the User, deduplicated by Item and including the User's own Shared Items.

**Rationale:** This count matches the global discovery list semantics.
