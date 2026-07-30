# Decision Record 0001: Domain grilling session

This record captures the question-and-answer decisions from the domain grilling session that shaped the current glossary, product intent, and architecture seams. Use it as the historical source when implementing future features and when revisiting whether a feature fits the intended model.

## Status

Accepted.

## Date

2026-07-12

## Decisions

### 1. What is the product actually about?

**Question:** Is the product a private inventory, shared inventory, borrow/lend coordination, discovery/availability, or something else?

**Answer:** It is all of those in the bigger picture, but the current MVP is private inventory.

**Decision:** Treat the current implementation as a private inventory MVP, while documenting the future direction toward sharing, borrowing, and availability.

### 2. Who owns an Item?

**Question:** Is an Item owned by a User, a Household, either, or is ownership less important than custody?

**Answer:** Household ownership initially seemed sensible because the registered User was imagined as a front person for a household.

**Follow-up decision:** This was later revised. Product behavior should be bound to the User for now. Household remains descriptive context only.

### 3. What is a Household?

**Question:** Is a Household a physical residence, trust group, account container, social unit, or something else?

**Answer:** A Household can have Items at different places, but after further discussion it should not carry product logic yet.

**Decision:** Household is a real-world social context around a User. It may become important later, but it is not the current accountability or authorization boundary.

### 4. How should item location be understood?

**Question:** Is the app tracking current location, geolocation, placement, movement history, or planned/reserved location?

**Answer:** The app should record where an Item is typically kept, not track every movement. Locations may later have latitude/longitude for OpenStreetMap integration.

**Decision:** Use `Typical Location` for the reusable saved place where an Item is normally kept. Use `Typical Placement` for the more precise place within that location. Avoid `current location` and `geo-location` as domain terms.

### 5. Does the app track item movement?

**Question:** When an Item moves, should the app track current location, history, custody history, or planned location?

**Answer:** The intent is not to relocate an Item every time it moves. Users may update an Item's location rarely, maybe once a year or every five years.

**Decision:** Typical Location and Typical Placement describe where the Item normally lives. The product is not a real-time asset tracker or movement-history system.

### 6. Is payment in scope?

**Question:** Is sharing related to payment, rental, sale, or marketplace behavior?

**Answer:** No. This application must never be about payment. Sharing means borrowing only.

**Decision:** Payment, rental, sale, and marketplace concepts are out of scope. Borrowing is temporary use without payment.

### 7. What is being reserved?

**Question:** Does a Reservation reserve an Item, an Item at a Location, an Item for a Borrower, or movement/placement?

**Answer:** A Reservation is about availability to a person, not planned relocation.

**Decision:** A Reservation is a planned future claim by a User to borrow a Shared Item.

### 8. Who can reserve or borrow?

**Question:** Is the borrower a registered User, an invited person, a Household member, or something broader?

**Answer:** The model eventually shifted away from Household-bound behavior and toward User accountability.

**Decision:** A User requests Reservations and borrows Items. Household does not carry borrowing accountability for now.

### 9. How do Sharing Groups work?

**Question:** Can a Household/User create a group and invite others? What flows through the group?

**Answer:** A User can create a group such as a family, friend group, association, etc. Other Users can be invited. An Item can be shared with multiple groups, but sharing is optional.

**Decision:** A `Sharing Group` is a mutual relationship space between Users. Users join groups as Members. Items remain owned by their owning User and become visible through group sharing.

### 10. Does a Sharing Group own Items?

**Question:** Should a group contain/own Items, or should Items remain owned elsewhere and be made visible through the group?

**Answer:** Items should remain owned by their owning User. The group is the visibility relationship.

**Decision:** Do not model a Sharing Group as owning Items. Model sharing as a binary relationship between an Item and a Sharing Group.

### 11. What exactly is shared when an Item is shared?

**Question:** Do Members see basic data, location, availability/reservation state, owner identity, or configurable fields?

**Answer:** Members should see basic data, availability/reservation state, and full Typical Location. Typical Placement is shown only once a Reservation is accepted by the owner.

**Decision:** Sharing an Item to a Sharing Group reveals basic details, Item Photos, availability/reservation state, and full Typical Location. Typical Placement remains hidden until Reservation acceptance.

### 12. Is full Typical Location safe to share?

**Question:** Should Members see the full location, a label only, an approximate area, configurable location details, or no location until acceptance?

**Answer:** Full Typical Location is accepted. Permission comes through the Item's sharing status with the Sharing Group.

**Decision:** Sharing an Item is consent to reveal its full Typical Location to Members of that Sharing Group.

### 13. What is the lifecycle of sharing an Item?

**Question:** Should sharing be shared/not shared, draft/shared/unshared, shared/paused/unshared, or richer?

**Answer:** Keep it simple. More statuses do not enrich the end user right now.

**Decision:** Sharing is binary per Item and Sharing Group: shared or not shared.

### 14. What is availability?

**Question:** Is a Shared Item always requestable unless already reserved, governed by unavailable ranges, governed by available ranges, or manually approved every time?

**Answer:** Shared means requestable, owner approval is required, and accepted Reservations block conflicts.

**Decision:** Do not model an availability calendar yet. A Shared Item is requestable unless an existing accepted Reservation conflicts with the requested time.

### 15. Is Reservation the same as Borrowing?

**Question:** Should the app track accepted reservation only, borrowing start/end, automatic borrowing during the reserved time, or defer borrowing lifecycle?

**Answer:** Defer borrowing lifecycle. Accepted Reservation is enough for now.

**Decision:** Keep Reservation separate from Borrowing. Do not model pickup/return until users prove that lifecycle is valuable.

### 16. Who can share into a Sharing Group?

**Question:** Can any Member share their own Items into a group, or only the creator?

**Answer:** Any Member should be able to share their own Items into the group.

**Decision:** Sharing Groups are mutual spaces. Any Member may share their own Items into the group.

### 17. Who manages Sharing Group membership?

**Question:** Is group membership creator-managed, admin-managed, open to member invites, invite-link based, or deferred?

**Answer:** Creator-managed for now.

**Decision:** The creating User manages Sharing Group membership for now.

### 18. What is invited to a Sharing Group?

**Question:** Is an invitation sent to a User email, an existing Household, a person who creates a Household, an invite link, or something else?

**Answer:** Invite a User email.

**Decision:** An Invitation is sent to a User email for that User to join a Sharing Group.

### 19. What if an invited User has no Household?

**Question:** Should accepting create a Household, join someone else's Household, require selecting a Household, or be impossible?

**Answer:** Initially, a new Household would be created, but this led to rethinking the model.

**Follow-up decision:** Product logic should move to the User. Household remains an empty/descriptive shell without accountability for now.

### 20. Should behavior be bound to User or Household?

**Question:** Are Items, groups, reservations, and borrowing accountable to Household or User?

**Answer:** Move everything currently discussed to the User instead of Household. Household should not carry logic yet.

**Decision:** User is the current accountability boundary. Household is descriptive future context only.

### 21. What should user-facing language say?

**Question:** Should the UI say "your stuff", "your household's stuff", or avoid household language?

**Answer:** Use personal language.

**Decision:** Product language should say "your inventory", "your items", "share your item", "borrow from others", "groups you joined", and "items shared with you". Avoid household-facing language until household collaboration exists.

### 22. How should Typical Location be modeled?

**Question:** Should Typical Location be free text, a reusable saved Location, free text migrated later, or saved now?

**Answer:** A reusable saved Location.

**Decision:** Typical Location is a reusable saved place belonging to a User. Items reference it once implemented.

### 23. Can an Item have no Typical Location?

**Question:** Should an Item require a Typical Location, allow none, allow none until sharing, or require it when sharing?

**Answer:** Sharing requires Typical Location.

**Decision:** Private Items may exist without a Typical Location. An Item must have a Typical Location before it can be shared.

### 24. Is Typical Placement required?

**Question:** Should Typical Placement be optional, required before sharing, required before accepting a Reservation, or encouraged but optional?

**Answer:** Encouraged but optional. UX can say that no Typical Placement has been noted.

**Decision:** Typical Placement is optional and encouraged, not required.

### 25. Are categories in scope?

**Question:** Should categorization be search-only, user tags, fixed categories, fixed plus tags, or later?

**Answer:** Later. Categories will likely matter, but they can grow large and should not be decided now.

**Decision:** Do not model categories or tags yet.

### 26. Are Item Photos in scope?

**Question:** Should an Item have one photo, multiple photos, photos later, photos required to share, or avoid photos?

**Answer:** Photos are required to share.

**Decision:** An Item must have at least one Item Photo before it can be shared.

### 27. Are Item Photos private or shared individually?

**Question:** Are photos private unless the Item is shared, can some be private/shared, are all photos visible on a Shared Item, or only one primary shared photo?

**Answer:** All photos on a Shared Item are visible.

**Decision:** There is no per-photo privacy distinction for now. All Item Photos on a Shared Item are visible to Members of the Sharing Groups where the Item is shared.

### 28. Can the same Item be shared differently to different Sharing Groups?

**Question:** Is shared data the same everywhere, customizable per group, visibility-only per group, or reservation rules different later?

**Answer:** Same item data everywhere. Per-group sharing only controls visibility.

**Decision:** Do not model per-group item content overrides.

### 29. What is the Reservation time granularity?

**Question:** Should Reservations be date-only, date-time, start/end date only, flexible text, or later?

**Answer:** Date-time, because it supports calendar views better.

**Decision:** Reservation start and end should be date-time values.

### 30. Which timezone owns Reservation time?

**Question:** Should Reservation time be based on the Item's Typical Location timezone, owning User timezone, requesting User timezone, viewer-local time, or UTC only?

**Answer:** Use the Typical Location timezone. Store UTC internally, but the decision and meaning should be location-local.

**Decision:** Reservation time is location-local. The Typical Location timezone owns the meaning of start and end time. UTC storage is an implementation detail.

### 31. How are Sharing Groups discovered?

**Question:** Invitation-only, public searchable, invite links, private by default/public later, or later?

**Answer:** Invitation-only.

**Decision:** Sharing Groups are invitation-only for now.

### 32. What happens when a User leaves or is removed from a Sharing Group?

**Question:** Do their shared Items stop being shared, remain visible historically, preserve accepted Reservations, differ by removal/leave, or later?

**Answer:** Their Items stop being shared with that group.

**Decision:** If a User leaves or is removed from a Sharing Group, their Items stop being shared with that Sharing Group. Reservation consequences should be decided when Reservations are implemented.

### 33. What happens when an Item is unshared or deleted with Reservations?

**Question:** Block delete/unshare, allow unshare but keep Reservations, cancel on delete, soft-delete, or later?

**Answer:** Unsharing should not cancel accepted Reservations. Deleting should be blocked or soft-deleted while accepted future Reservations exist.

**Decision:** Unsharing stops new visibility/requestability but does not cancel already accepted Reservations. Deleting an Item should be blocked or soft-deleted while accepted future Reservations exist.

### 34. What is the next concrete milestone?

**Question:** Add Typical Locations, Item Photos, Sharing Groups/Invitations, Item sharing, or refactor names/seams only?

**Answer:** Refactor names/seams only, no new feature yet.

**Decision:** The immediate cleanup is documentation and alignment. Do not add new sharing, reservation, location, photo, category, or household behavior yet.

## Resulting implementation guidance

Future implementation should compare new features against:

- `CONTEXT.md` for canonical language.
- `docs/product-intent.md` for product direction and non-goals.
- `docs/architecture/seams.md` for boundaries and implementation seams.

This decision record is the historical transcript-style source for why those docs say what they say.
