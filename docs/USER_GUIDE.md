# CrowdCAD User Guide (overview)

This document is a short, user-focused guide to the primary workflows in CrowdCAD. Refer to the web feature pages and project UI for detailed, contextual help: https://crowdcad.org/features

## Who this is for

- Event medical volunteers and supervisors
- Small teams running first-aid stations at public events
- Organizers who need logs, incident tracking, and simple dispatch tools

## Quick start (user)

1. Open the CrowdCAD deployment URL provided by your organization.
2. Sign in using the provided authentication method (email + password).
3. Select or create an Event (if you have permission).
4. Create or join a Team/Unit assigned to the Event.
5. Use the Dispatch interface to log calls, assign teams, and close incidents.

## Lite mode (local-only)

- Open `/lite` to use CrowdCAD Lite without cloud sync.
- Lite mode stores data in your browser (IndexedDB/local storage) on the current device.
- In Lite Event Setup, you can add/edit locations, equipment, and teams before starting dispatch.
- Teams can be edited from the Teams panel using the pencil icon.
- Use this mode for quick local workflows when internet or account access is unavailable.

## Basic concepts

- Event: an organized occurrence (concert, festival, sports match) with its own roster, venues and logs.
- Venue: a physical place inside an event (first-aid tent, roving patrol area).
- Team / Unit: a group of volunteers or staff with assigned roles.
- Call / Incident: a logged patient encounter or service request.
- Dispatch Log: chronological record of assignments, statuses, and notes.

## Typical workflows

Sign In

- Use your organization's sign-in method. If you cannot sign in, contact your local CrowdCAD admin or the maintainers.

Create or Join an Event

- Users with permission can create a new Event and configure time, venues, and roster.
- Join an existing Event by invitation or via the event selector.

Create a Team

- From the Event dashboard, create a Team and add members (by email or existing accounts).

Log a Call / Incident

- Open the Dispatch interface and click the “New Call” or “Quick Call” button.
- Enter the location (venue), time, patient information (minimal), and notes about the condition.
- Assign a Team or responder and set the call status (e.g., triaged, treated, transported).

Assigning & Tracking

- Use the map or venue selector to assign teams to locations.
- Update statuses on the Dispatch Log so others can see who is available or responding.

Closing an Incident

- Add final notes, set disposition (treated on-site, transported, released) and close the call. The entry remains in the Dispatch Log for later review and export.

Exporting Logs

- Dispatchers can export event logs and reports for post-event review. Check the admin panel for export options.

Importing a GIS Venue Map

- From a venue's Map step, "Or import a GIS map with pre-placed points and areas" opens the GIS import dialog — an alternative to manually placing markers/areas, for venues whose layout already exists in a GIS tool (e.g. ArcGIS).
- You provide: a flattened background image (the map picture itself), and one or two GeoJSON files — one for point locations, one for polygon areas. Either file can be omitted if you only have one kind of feature; a single combined GeoJSON file (with both Point and Polygon features) also works, uploaded as either one.
- ArcGIS (and most GIS tools) typically export one geometry type per layer, so a point layer and a polygon layer usually come out as two separate files — that maps directly onto the dialog's two file inputs.
- **Point features** need a `name` property (text); an optional `isClinic` boolean marks that location as a clinic, same as checking "Mark as Clinic" when placing a marker by hand.
- **Polygon features** (or MultiPolygon — only the first polygon's outer ring is used) need a `name` property; optional `isDispatchZone` (boolean) marks it as a dispatch zone, same as checking "Mark as Dispatch Zone" when drawing an area by hand, and optional `color` (a hex string like `"#22c55e"`) sets its map color — omitted, it's auto-assigned.
- Georeferencing (lining features up correctly on the image) uses the FeatureCollection's `bbox`, or falls back to the min/max extent of the features themselves if no `bbox` is present. If both a points file and a polygons file are uploaded, the same shared bounds is used for both, so they land in a consistent position relative to each other.
- See `docs/examples/venue-map-import.geojson` for a minimal worked example (one clinic point, one dispatch-zone polygon). The import preview shows points and areas overlaid on the background image before you confirm — check that they line up with their real locations; if they look off, the bbox likely doesn't match the image's extent.

Privacy & Data Handling

- Only collect the minimal information necessary to provide care.
- Do not store personally identifying information unless essential, and ensure your organization’s privacy policies and BAAs (if applicable) are followed.

Help & Support

- For bugs or feature requests, open a GitHub issue describing the problem.
- For security issues, follow `SECURITY.md` and report via `support@crowdcad.org` or GitHub Security Advisories.
- For deployment questions, consult `docs/DEPLOYMENT.md` (choosing a backend), `docs/SETUP_FIREBASE.md`, or `docs/SETUP_POCKETBASE.md`.

More information and screenshots: https://crowdcad.org/features
