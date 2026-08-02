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
The more precise place where an Item is normally kept within a Typical Location. When the Item is linked to a Placement Slot, that link plus an optional free-text note is the Typical Placement; otherwise Typical Placement may be free text only.
_Avoid_: Current placement, location, geo-location

**Placement Surface**:
A drawable 2D surface belonging to a Typical Location, such as a wall of cabinets or a bank of storage units, on which Placement Slots and Structural Drawings are arranged on an infinite millimetre sketch plane whose extent is derived from content. A Typical Location may have many Placement Surfaces.
_Avoid_: Floor plan, layout document, warehouse map, current placement map, fixed canvas size

**Placement Slot**:
A labeled addressable region on a Placement Surface that one or more Items may link to as their Typical Placement; identity is a stable id separate from a free-text human label that is unique per Typical Location (case-insensitive) and is the primary findability contract. Geometry is an axis-aligned rectangle in millimetres (sketch size and detail width/height are the same values).
_Avoid_: Bin SKU, stock location, geo-coordinate, hotspot only, label-as-identity

**Structural Drawing**:
Non-addressable geometry on a Placement Surface that provides visual structure—cabinet outlines, wall edges, dividers—cannot be linked as Typical Placement, and has no user-facing label.
_Avoid_: Placement Slot, decoration-only (too vague), background, structural caption

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
A Reservation Request in the accepted state. Acceptance freezes a snapshot of the Shared Item's Typical Placement for the borrowing User and blocks conflicting Reservation Requests from being accepted unless their requested time changes. The owning User's live Typical Placement and Placement Surfaces may change without rewriting that snapshot. If an Accepted Reservation is cancelled, it no longer blocks conflicts and the placement snapshot is hidden again from the borrowing User. A later re-accept captures a fresh snapshot; a Reservation Change Proposal that only changes the date-time range keeps the existing snapshot.
_Avoid_: Confirmed booking, paid reservation

**Reservation**:
A planned future claim by a User to borrow a Shared Item. Only an Accepted Reservation blocks conflicting borrowing claims; pending Reservation Requests do not hold the Item.
_Avoid_: Booking, rental, planned location

**Borrowing**:
Temporary use of a Shared Item by a User other than the owning User, without payment.
_Avoid_: Rental, sale, purchase

**Notification**:
A server-persisted record in one User's durable inbox that refers to a domain event involving existing concepts (for example an Invitation or Reservation Request). It is a separate projection for that recipient, not a second name for the underlying Invitation, Reservation Request, Reservation Change Proposal, or Member. A Notification is created Unread. It becomes Read when the recipient opens the subject's destination surface or when they perform the domain action that updates that Notification. Contentful updates from other parties or the system set it Unread again. Unread and Read are the only attention states for this entity; rows are not dismissed, archived, or removed by the User as part of attention.
_Avoid_: Alert, message, toast, push notification, email, attention item (as the entity name), seen, unseen, dismissed, archived (as synonyms for Unread/Read)
