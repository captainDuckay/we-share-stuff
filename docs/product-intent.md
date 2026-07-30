# Product Intent

We Share Stuff helps people organize physical things they own so those things can later be shared, borrowed, or made available to others.

The foundational question-and-answer history is recorded in [`decision-records/0001-domain-grilling.md`](./decision-records/0001-domain-grilling.md). My Page and User identity decisions are recorded in [`decision-records/0003-my-page.md`](./decision-records/0003-my-page.md).

## Current product posture

The current product is a private inventory MVP. A User tracks their own Items. Sharing, reservations, borrowing, photos, and saved locations are future-facing concepts unless implemented explicitly.

The product should stay personal in user-facing language for now:

- "your inventory"
- "your items"
- "share your item"
- "borrow from others"
- "groups you joined"
- "items shared with you"

Avoid household-facing language until household collaboration exists in product behavior.

## North star

People should be able to confidently lend and borrow physical things through trusted sharing relationships without turning the product into a marketplace, payment platform, logistics tracker, or warehouse system.

## Non-goals

We Share Stuff is not about:

- payments
- rentals
- sales
- monetized marketplaces
- real-time asset tracking
- detailed movement history for every item
- warehouse/logistics workflows

Borrowing is always temporary use without payment.

## Trust model

Sharing happens through invitation-only Sharing Groups. A User chooses which Items to share with which Sharing Groups. That sharing decision is the permission boundary for exposing the Item to members of that group.

Users identify one another through Display Names and optional Profile Photos when they are current Members of at least one shared Sharing Group or are the parties to an existing Reservation Request. Reservation history preserves this identity visibility after group membership ends. Authentication alone does not grant access to another User's profile, and there is no global User directory or profile search. Email addresses remain private and are used only where operationally necessary, such as authentication and sending Invitations; they are not displayed as another User's identity.

Sharing an Item is consent to reveal its basic details, Item Photos, reservation state, availability, and full Typical Location to members of the selected Sharing Group. Typical Placement remains hidden until a Reservation is accepted.

## Growth direction

The intended direction is:

1. Private User inventory
2. Saved Typical Locations
3. Item Photos
4. Sharing Groups, Invitations, and Membership
5. Item sharing into Sharing Groups
6. Reservation requests and acceptance
7. Borrowing lifecycle only if users prove pickup/return tracking is valuable

Household may become important later, but it is intentionally not a product logic boundary yet.
