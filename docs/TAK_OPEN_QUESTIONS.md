---
title: TAK Integration Open Questions for IC-EMS
purpose: Decisions needed to unblock remaining CrowdCAD-TAK engineering work
date: 2026-08-16
source: core/docs/TAK_INTEGRATION_PLAN.md § 11
---

# TAK Integration — Decisions needed from IC-EMS

## Why you're getting this

The CrowdCAD-TAK integration has reached a point where nearly every remaining engineering task is waiting on a decision from your organization. Several of these decisions have lead time measured in weeks, and the sooner they're made, the sooner implementation can proceed. This document lists the six decisions and one external artifact we need, what answer we're looking for, and why it matters.

---

## 1. PHI export policy — *Blocking now*

*(Plan §11, question 3)*

**The question:** Is any patient clinical information ever acceptable to broadcast outside CrowdCAD, or should TAK export be limited to location and status only?

**Why we're asking:** TAK is a broadcasting system — every connected map client and every federated partner agency sees everything published. There is no per-recipient access control. We are building a gate in CrowdCAD that lets you configure what leaves the system, but we need to know what policies to allow. The code is ready to enforce them; the policy is not.

**What changes depending on the answer:**
- **Location-only (recommended):** A marker at the incident location with a call number and location context only. This is operationally sufficient for "send help here." The software already supports this, and it is stricter than the default: today calls are not published to TAK at all unless someone turns them on for an event.
- **Full clinical export:** Requires a hard-blocked confirmation dialog in the UI, naming exactly which fields will be transmitted and stating they leave CrowdCAD's access controls. Much harder to walk back in the field.
- **Permanent ceiling:** If location-only is the answer, the codebase will never allow anything more, by design.

**What a usable answer looks like:** A clear yes/no to "can chief complaint (the call's clinical summary) ever leave CrowdCAD over TAK?" or "location and call number only, no exceptions." If yes, we need to know whether this applies to all events or some events (and how to configure which), and whether it requires explicit per-event approval from someone with clinical authority.

**Urgency:** *Blocking now.* The UI and security gates are ready to ship, but not without knowing this.

---

## 2. TAK.gov registration status — *Weeks of lead time, start now*

*(Plan §11, question 2)*

**The question:** Who will own the TAK.gov account if you choose the GOTS (Government Off-the-Shelf) server, and has the registration been started?

**Why we're asking:** TAK.gov registration is a formal approval process, not an automatic signup. It blocks access to the GOTS TAK server and to ATAK-CIV (the Android client). The process has lead time we don't control. We can unblock development with FreeTAKServer (open source, runs locally) in the meantime, but if you want GOTS for production, the clock starts now.

**What changes depending on the answer:**
- **GOTS server chosen, registration started:** We can proceed. The local FreeTAKServer unblocks development and testing.
- **GOTS server chosen, registration not started:** Same code path, but you will not have credentials until weeks later. Critical path item.
- **FreeTAKServer or CloudTAK chosen:** No TAK.gov dependency. We build for that environment immediately.

**What a usable answer looks like:** (1) Which server type (GOTS / FreeTAKServer / CloudTAK / other), (2) who owns the account or will own it, (3) if GOTS, the date the registration was submitted (or needs to be submitted).

**Urgency:** *Weeks of lead time, start now.* If GOTS registration is needed, it must start immediately. Every week of delay is a week the team cannot develop against the production server.

---

## 3. Federation expectations — *Weeks of lead time, start now*

*(Plan §11, question 6)*

**The question:** Will IC-EMS or other agencies you work with be federating their TAK servers this season? (Meaning: connecting multiple TAK servers so operators on one map see teams from another agency's server.)

**Why we're asking:** Federation requires certificate exchange and mutual operational agreements between organizations. That is organizational work, not software work, but it has lead time. If it is happening, you need to start those conversations immediately.

**What changes depending on the answer:**
- **No federation planned:** Simpler setup. Each organization runs their own server. Infrastructure can stay local.
- **Federation expected:** Certificate authority setup, cross-org agreements, mutual trust anchors. All of this happens before game day or not at all.

**What a usable answer looks like:** Yes/no to federation, and if yes, which other agencies. Names and contacts for whoever is handling the inter-agency agreements.

**Urgency:** *Weeks of lead time, start now.* Like TAK.gov registration, this is organizational lead time. The software will not block federation once the certs are ready, but the certs take weeks.

---

## 4. TAK server choice — *Blocking now*

*(Plan §11, question 1)*

**The question:** Which TAK server will IC-EMS use: GOTS (Government Off-the-Shelf), FreeTAKServer (open source), CloudTAK (web-based), or something else?

**Why we're asking:** This determines which code path gets built first. GOTS and CloudTAK have different interfaces; FreeTAKServer has a different deployment model. To be clear about where we actually are: we have built and tested against **FreeTAKServer only**. There is no support for GOTS or CloudTAK today — those would be new work, and how much is not yet known. Naming your server is what tells us whether the thing we have already proven is the thing you will actually run.

**What changes depending on the answer:** If FreeTAKServer, we are already on the right path and the work continues. If GOTS or CloudTAK, we need to scope an additional integration before it can be considered ready, and that scoping should start as soon as we know.

**What a usable answer looks like:** The server type, and who operates it. If the decision is not yet made, tell us that too — "undecided" is a usable answer and changes how we sequence the work.

**Urgency:** *Blocking now.* We need this to finalize the priority order for engineering work.

---

## 5. Field provider devices — *Needed before first deployment*

*(Plan §11, question 5)*

**The question:** Will field providers (paramedics, responders) be carrying ATAK or another TAK app, or will they use a web browser?

**Why we're asking:** This decides the roadmap priority between two phases. If you have ATAK on every phone, we prioritize the ATAK plugin UI (a native Android experience with status buttons and a richer interface). If field providers use a browser instead, we prioritize the mobile web app (three large buttons: arrived, patient contact, clear; no TAK.gov registration, no APK sideloading, works on any phone with a browser). The browser path is simpler and is actually the one that solves your stated operational problem — field providers reporting status without radio.

**What changes depending on the answer:**
- **ATAK or iTAK on every phone:** Plugin development becomes a later priority, after the core bridge is working.
- **Browser / web app:** Mobile web app becomes the primary field interface. TAK integration is supporting infrastructure.

**What a usable answer looks like:** "Field providers will carry [ATAK / iPhone / mix of both / ???]" and "The UI they need most is [status buttons / full map / something else]."

**Urgency:** *Needed before first deployment.* This is longer-term roadmap, not blocking the next sprint.

---

## 6. Georeferenced venue overlay — *Needed before first deployment*

*(Plan §11, question 4)*

**This is not a question, but a blocking external ask.**

To validate the coordinate math before going live, we need an existing georeferenced venue map — the kind of file WinTAK uses. Specifically:

- A KMZ file (the zipped geographic format TAK clients understand) or a GeoTIFF (a map image that already carries real-world coordinates embedded in it)
- Of your actual event venue, with the real latitude/longitude coordinates
- Enough detail to see a few landmarks (gates, field areas, structure corners)

We can use this to verify that when we calculate "post A is at 37.8721° N, 122.2578° W," those coordinates actually match the real ground. Right now we test against synthetic data; a real overlay lets us catch calibration errors before they appear on a responder's map in the field.

**What a usable answer looks like:** The file itself, and confirmation that it is accurate to the venue as it will be during your event.

**Urgency:** *Needed before first deployment.* Required for validation, not blocking development.

---

## What we need from you — actions

1. **Assign owners for each answer.** Not every question needs the same person.
   - PHI policy (§1) — clinical/legal authority
   - TAK.gov registration status (§2) + server choice (§4) — ops lead who runs comms infrastructure  
   - Federation (§3) — inter-agency liaison, if applicable
   - Field device type (§5) — field operations lead
   - Georeferenced overlay (§6) — GIS/IT, or whoever prepared the original venue image

2. **Prioritize questions 1–4.** These unblock the next two sprints. Get answers to those in the next week if possible.

3. **Start TAK.gov and federation work immediately if those are your path.** Both have lead time we cannot compress.

4. **Provide the georeferenced overlay when you have it.** It is needed before live deployment, not immediately, but locating it now saves a search later.

---

## Background: what TAK does and doesn't solve

This is pulled from the engineering plan so you know what you are asking the team to build.

**TAK will give you:**
- A common map picture shared with any other agency that runs TAK (university police, county EMS, fire)
- Live position of teams on a map, visible to everyone with access to the server
- Outdoor and cross-venue geospatial awareness — teams moving between lots, gates, and the venue perimeter

**TAK will NOT give you:**
- Multi-level disambiguation inside a building. GPS cannot tell the difference between level 1 and level 3. CrowdCAD tracks which level each team is on, and we carry that information in the TAK export, but the map will show every level stacked at one location.
- 3D seating with wireframes. That is a surveying/LiDAR engagement, not a software feature.
- Answers to "why can't the radio reach the field?" — TAK is a map tool, not a radio replacement. The operational need IC-EMS described is field providers pressing arrived/clear/moving without radio. That is best solved by a simple mobile web app with three buttons and a background location ping. TAK integration is how you share that data with other agencies' maps.

---

## For reference

- The full engineering plan is at `core/docs/TAK_INTEGRATION_PLAN.md` § 11 in the repository. Each question above notes the plan's original numbering for cross-reference.
- The TAK integration is being built on the `feature/tak-integration` branch.
- **Current state, stated plainly:** positions flowing *from* a phone *into* CrowdCAD have been demonstrated on real hardware — an iPhone running iTAK, through a local FreeTAKServer. The reverse direction, CrowdCAD publishing its picture out *to* TAK, is built but has never transmitted; it is waiting on a verification step that needs a real TAK client in someone's hands. Nothing described in this document is in production use yet.
