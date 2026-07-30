# We Share Stuff

We Share Stuff helps people organize physical things they own so those things can later be shared, borrowed, or made available to others.

## Language

**User**:
An authenticated person who owns Items, manages an Inventory, joins Sharing Groups, shares Items, and is accountable for Reservations and Borrowing. For now, product behavior is bound to the User rather than to a Household.
_Avoid_: Account, owner account

**Display Name**:
The required User-chosen name that represents a User to current Members of their Sharing Groups and to Users with whom they have a Reservation Request, without exposing their email address. Display Names need not be unique.
_Avoid_: Full name, legal name, username

**Profile Photo**:
An optional photo representing a User to current Members of their Sharing Groups and to Users with whom they have a Reservation Request.
_Avoid_: Avatar, profile picture, user image

**Household**:
A real-world social group around a User, such as a family or home, that may later become a stronger collaboration boundary. For now, Household is descriptive context and should not carry product logic or accountability.
_Avoid_: Owner, account, workspace

**Inventory**:
The collection of Items belonging to a User.
_Avoid_: Item list, household inventory

**Item**:
A physical thing a User owns, tracks in their Inventory, and may later lend to others. An Item can have Categories, a Typical Location, and a more precise Typical Placement. User-facing copy may say “tool” where that is friendlier, but the domain term remains Item.
_Avoid_: Product, asset

**Category**:
A reusable classification for Items that helps Users browse and describe similar things. An Item may have zero or more Categories.
_Avoid_: Tag, type, label

**Typical Location**:
A reusable saved place belonging to a User where Items are normally kept, such as a home address or summerhouse. A Typical Location has a timezone, which gives meaning to Reservation Request date-time ranges; it may later have map coordinates, but the domain term is the place rather than the coordinates.
_Avoid_: Current location, geo-location, address

**Typical Placement**:
The more precise place where an Item is normally kept within a Typical Location, such as a garage, cabinet, shelf, or marked container.
_Avoid_: Current placement, location, geo-location

**Sharing Group**:
A mutual relationship space created by a User for sharing Items with other Users, such as a family group, friend group, or association. Any Member may share their own Items into the Sharing Group, while the creating User manages membership for now.
_Avoid_: Group, circle, organization

**Sharing Group Photo**:
An optional photo or logo representing a Sharing Group. A client may show a generic placeholder when no Sharing Group Photo exists, but that placeholder is not part of the Sharing Group.
_Avoid_: Sharing Group Visual, Group image, icon, asset, media

**Member**:
A User who has joined a Sharing Group.
_Avoid_: Member household, participant

**Invitation**:
An invitation sent to a User email for that User to join a Sharing Group.
_Avoid_: Invite link, member request

**Item Photo**:
An optional photo representing an Item so other Users can recognize what may be borrowed. A client may show a generic placeholder when an Item has no Item Photo, but that placeholder is not part of the Item.
_Avoid_: Item Visual, icon, asset, media

**Shared Item**:
An Item whose owning User has made visible to a Sharing Group. Sharing is binary per Item and Sharing Group: an Item is either shared or not shared, and an Item must have a Typical Location before it can be shared. Members can see the Shared Item's basic details, Item Photos, availability, reservation state, and full Typical Location, but not its Typical Placement until a Reservation is accepted.
_Avoid_: Public item, group item

**Reservation Request**:
A User's request to borrow a Shared Item for a date-time range. A Reservation Request does not block other Users from making overlapping requests, remains actionable if the Item is later unshared, and has an explicit lifecycle: pending, accepted, declined, withdrawn, or cancelled.
_Avoid_: Hold, booking request, message

**Reservation Change Proposal**:
A proposed change to a Reservation Request's date-time range that must be approved by the other party before it takes effect. Either the requesting User or the owning User may propose one, including after the Reservation Request has already been accepted; if the underlying Reservation Request ends first, the pending proposal becomes void.
_Avoid_: Counterproposal, edit, unilateral change

**Accepted Reservation**:
A Reservation Request in the accepted state. Acceptance reveals the Shared Item's Typical Placement to the borrowing User and blocks conflicting Reservation Requests from being accepted unless their requested time changes. If an Accepted Reservation is cancelled, it no longer blocks conflicts and the Typical Placement is hidden again from the borrowing User.
_Avoid_: Confirmed booking, paid reservation

**Reservation**:
A planned future claim by a User to borrow a Shared Item. Only an Accepted Reservation blocks conflicting borrowing claims; pending Reservation Requests do not hold the Item.
_Avoid_: Booking, rental, planned location

**Borrowing**:
Temporary use of a Shared Item by a User other than the owning User, without payment.
_Avoid_: Rental, sale, purchase
