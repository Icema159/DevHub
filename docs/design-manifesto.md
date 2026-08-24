# Developer Knowledge Hub design manifesto

This manifesto records the visual system that is already implemented and accepted across the
production Login, Register, Dashboard, Documents, Document Details, Chat, dialogs, and shared UI
Kit. It is a constraint for future product work, not an invitation to add decoration.

## Product character

Developer Knowledge Hub is calm, premium, trustworthy, developer-focused, and information-first.
Its identity is restrained: the product should feel crafted without asking visual effects to carry
the experience. Content, source evidence, lifecycle state, and user decisions remain easier to
notice than the interface around them.

## Material hierarchy

The product uses five deliberate material roles:

1. **Atmospheric Canvas** — a quiet light background that carries the environmental color.
2. **Navigation Glass** — the strongest translucent material, reserved for global orientation.
3. **Workspace / Interaction Glass** — restrained glass for workspace chrome, identity, selection,
   filters, and controls.
4. **Solid Knowledge / Information Surface** — near-opaque surfaces for documents, answers,
   citations, metadata, lifecycle facts, and decisions.
5. **Elevated Interaction Surface** — temporary or focused interaction such as the Composer and
   modal dialogs.

Glass is used for orientation and interaction. Solid surfaces are used for knowledge and
decisions. Glass surrounds knowledge; it does not obscure knowledge.

## Core principles

- The environment moves; the interface remains stable.
- Reading is sacred. Long-form answers, evidence, metadata, and operational state stay readable.
- Depth comes from material hierarchy, not shadow fog.
- Information density follows the task instead of one universal card layout.
- Backend-authoritative states and actions define the interface. Visual polish must not invent
  progress, metadata, controls, or capabilities.
- Accessibility, contrast, and safe text rendering take priority over visual novelty.

## Living Glass

The environmental system uses exactly three broad, low-saturation light fields beneath the UI.
They move slowly on independent transform-only cycles. There is no mouse-follow behavior, pulsing,
particle system, or surface animation.

`prefers-reduced-motion` keeps the atmosphere static. Browsers without backdrop filtering receive
more opaque fallbacks so hierarchy and readability do not depend on blur support. Mobile uses a
calmer, denser treatment than desktop.

## Edge language

Glass edges are local, asymmetric, restrained, and environment-reactive. Highlights may appear
near a plausible light source, but they must not form a continuous blue-purple perimeter. Avoid
neon rims, doubled white optical thickness, and decorative borders that compete with content.

## Semantic color

Semantic color always includes an icon and understandable text:

- **Ready** — restrained mint/green.
- **Processing** — restrained amber.
- **Failed** — restrained coral/red.
- **Info** — blue/indigo.

Color supports meaning; it never carries meaning alone. Semantic color remains contained. A
successful document does not produce a green glow, and a failed document does not turn the whole
workspace red.

## Density by workspace

- **Chat** is interaction-heavy. Conversation navigation and composition use glass; answers and
  citations remain solid.
- **Dashboard** is overview-heavy. Primary actions use restrained interaction glass; metrics and
  operational summaries remain stable and mostly solid.
- **Documents** is management-heavy. Search and filters use one interaction layer; the library is
  a dense solid management surface.
- **Document Details** is inspection- and decision-heavy. Identity and Refresh use restrained
  glass; lifecycle, metadata, recovery, and Delete decisions use solid surfaces.

## Typography and icons

Inter and the shared semantic type utilities establish one hierarchy for page headings, section
headings, body copy, metadata, and captions. Muted text must remain readable. Lucide icons support
orientation and meaning; they do not replace labels on important actions.

## Accessibility

- Keyboard focus indicators are real and visible.
- Reduced motion freezes the environmental animation.
- Knowledge and decision surfaces remain readable and near-opaque.
- Statuses use icon plus text rather than color alone.
- Touch targets for primary navigation and lifecycle actions are practical on mobile.
- User, filename, document, error, and AI content is rendered as inert text unless a separately
  approved safe renderer exists.
- Dialogs preserve focus entry, Escape behavior, pending-state protection, and focus restoration.

## Explicit anti-patterns

- No generic “AI slop” decoration.
- No neon or glowing AI orb.
- No excessive glass or translucent reading surfaces.
- No floating cards everywhere.
- No moving interface panels.
- No decorative motion competing with knowledge.
- No continuous gradient borders.
- No giant marketing illustrations inside the product workspace.
- No fake progress, unsupported actions, invented metadata, or browser-inferred server state.

## Change rule

Chat, Dashboard, Documents, Document Details, the global Sidebar, the shared material system, and
the semantic status language are frozen Phase 12 production anchors. Future work may extend them
for a real product requirement or correct a demonstrated accessibility or responsive defect, but
must not casually introduce a new visual direction or unrelated material family.
