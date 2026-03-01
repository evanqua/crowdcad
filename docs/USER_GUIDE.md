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

Privacy & Data Handling

- Only collect the minimal information necessary to provide care.
- Do not store personally identifying information unless essential, and ensure your organization’s privacy policies and BAAs (if applicable) are followed.

Help & Support

- For bugs or feature requests, open a GitHub issue describing the problem.
- For security issues, follow `SECURITY.md` and report via `support@crowdcad.org` or GitHub Security Advisories.
- For deployment questions, consult `docs/FIREBASE_SETUP.md` and `docs/DEPLOYMENT.md`.

More information and screenshots: https://crowdcad.org/features
