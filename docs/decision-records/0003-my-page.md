# Decision Record 0003: My Page and User identity

This record captures the decisions from the grilling session about the signed-in User's My Page, profile identity, header account menu, and Typical Location management.

## Status

Accepted.

## Date

2026-07-18

## Decisions

### 1. What is My Page?

**Decision:** My Page is one consolidated signed-in destination at `/my-page`.

**Rationale:** Profile and Typical Location management belong together as personal account management. Separate Profile and Settings destinations would create unnecessary navigation and an empty speculative Settings surface.

### 2. What appears on My Page initially?

**Decision:** My Page contains a Profile section and a Typical Locations section.

**Rationale:** These are the concrete management needs in the current milestone. There is no Settings section until an actual preference exists. Changing email, changing password, and deleting the User are out of scope.

### 3. What identity does a User have?

**Decision:** Every User has a required Display Name and may have one optional Profile Photo. Display Names need not be unique.

**Rationale:** Other Users need a recognizable identity that does not depend on exposing email. Display Name is not a username, legal name, or unique credential.

### 4. How are existing and future Users given a Display Name?

**Decision:** Registration requires a Display Name. The database migration backfills pre-launch User records with the generic Display Name `User`; it must not derive a visible name from an email address.

**Rationale:** No real Users are using the application yet, so a migration is sufficient and an onboarding gate is unnecessary. Email-derived defaults would undermine the privacy decision.

### 5. How are email addresses treated?

**Decision:** Email addresses are private operational data. They may be used for authentication and sending or managing Invitations, and the signed-in User may see their own email read-only on My Page. An email must not be displayed as another User's identity.

**Rationale:** Display Name and Profile Photo provide social identity without exposing a private credential or contact detail.

### 6. Who can see a User's Display Name and Profile Photo?

**Decision:** A User may see another User's Display Name and Profile Photo when they are current Members of at least one common Sharing Group or are the two parties to an existing Reservation Request. Reservation history preserves that identity visibility after Sharing Group membership ends.

**Rationale:** Authentication alone is not a trust relationship, but Reservation Requests remain visible and actionable after Item visibility or common membership is lost. The involved Users must remain identifiable in that retained history.

### 7. Is User discovery or a User profile detail page in scope?

**Decision:** No. There is no global User directory, profile search, or member-facing User profile page. Other Users' names and photos appear only in the Sharing Group, Shared Item, and Reservation contexts that authorize them, and are not links to a profile page.

**Rationale:** This milestone needs contextual identity, not public profiles, contact details, or direct messaging.

### 8. How does Profile Photo upload work?

**Decision:** A User may upload, preview, replace, and remove one Profile Photo. JPEG, PNG, and WebP files up to 10 MB are accepted. The original file is retained, while the UI displays a centered square crop. A crop editor is out of scope.

**Rationale:** These rules align with existing Item Photo constraints and provide a useful first version without introducing image-editing tooling.

### 9. What is shown when there is no Profile Photo?

**Decision:** The UI derives initials from Display Name, never email. A one-word name uses one initial; a multi-word name uses the first and last word's initials.

**Rationale:** The fallback remains recognizable without leaking email-derived information.

### 10. How does the header account control work?

**Decision:** The visible email and standalone Sign out button are replaced by one avatar button. It shows the Profile Photo or Display Name initials. Its accessible menu shows the Display Name, a My page link, and Sign out. It supports keyboard navigation, Escape, outside-click dismissal, and focus restoration.

**Rationale:** This gives account actions a conventional compact home while preserving accessibility. Sign out remains readily available without occupying permanent header space.

### 11. What can a User do with Typical Locations on My Page?

**Decision:** A User can list, add, edit, and delete their Typical Locations. Each entry shows its name, address or directions, timezone, and assigned Item count.

**Rationale:** The backend already supports Typical Location CRUD, but Users need a dedicated management surface and enough context to understand how each place is used.

### 12. What does the Typical Location form collect?

**Decision:** Name and timezone are required. Address or directions are optional and use the existing Typical Location details field. New forms initially select the browser's IANA timezone, which the User may change.

**Rationale:** A reusable place can be meaningful without a formal street address, while timezone remains necessary for location-local Reservation date-times.

### 13. What happens when an in-use Typical Location is deleted?

**Decision:** Deletion is blocked while any Item uses the Typical Location. The product does not silently detach Items or bulk-reassign them in this milestone.

**Rationale:** Detaching could make a Shared Item violate its requirement to have a Typical Location. Explicit reassignment avoids accidental location changes.

### 14. How does a User resolve an in-use Typical Location?

**Decision:** Each Typical Location shows its assigned Item count and provides a View items action that opens My Stuff filtered to that Typical Location. Delete remains unavailable or fails clearly until the Items are reassigned.

**Rationale:** A blocked deletion must be actionable rather than forcing the User to manually search their entire Inventory.

### 15. Is there a Default Typical Location?

**Decision:** No. A User explicitly chooses a Typical Location for each Item.

**Rationale:** Silent assignment risks recording or sharing an incorrect place. A user-selected default can be added later if repeated selection proves burdensome.

## Resulting implementation guidance

The implementation should cover both `frontend/` and `backend/` and should include:

- a database migration for required, non-unique Display Name and optional Profile Photo data;
- registration, session, and own-profile APIs that return and update Display Name and Profile Photo without using email as public identity;
- authorization for profile summaries and photo content based on common Sharing Group membership or involvement in an existing Reservation Request;
- removal of email from public/member-facing User summaries throughout Sharing Groups, Shared Items, Reservations, and Reservation Change Proposals;
- replacement of frontend helpers and templates that currently derive names or initials from email;
- Profile Photo upload, replacement, removal, validation, storage, and authorized content delivery;
- the `/my-page` route, Profile management, and Typical Location management;
- assigned Item counts for Typical Locations and a location-filtered My Stuff view;
- the accessible header avatar menu; and
- backend and frontend tests for privacy, authorization, migration behavior, forms, CRUD states, filters, and the menu.

Implementation should preserve Invitation email where it is operationally necessary, such as showing a group manager which pending email address they invited. It must not use that email as the accepted Member's profile identity.
