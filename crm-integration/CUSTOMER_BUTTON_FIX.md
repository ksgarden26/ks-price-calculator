KS Garden Services — customer profile and booking repair

Status: tested with fictional data; not applied to the live Apps Script project.

13 October profile-opening update: if you installed the previous ID fix, replace only Index and redeploy the existing private admin deployment as a New version. Keep CustomerIdentityAddon in place; no ID repair rerun is needed. Customer profiles now open before separate access/preferences requests. The Customers home tile and the dashboard show the total number of customer records, including Active customers; enquiry, quote and won-job counters retain their actual meanings. Unavailable details show a visible message, and saving remains blocked where needed to protect saved information. Quote visits hide maintenance frequency and default to a 30-minute visit; agreed jobs keep maintenance scheduling.

Install in the existing PRIVATE admin Apps Script project:
1. Replace the contents of the HTML file named Index with Index.html from this package.
2. Add a Script file named CustomerIdentityAddon and paste CustomerIdentityAddon.gs into it.
3. Save, select ksRepairCustomerIds in the function menu and Run once.
4. Deploy > Manage deployments > edit the existing PRIVATE admin deployment > New version > Deploy.
5. Reopen or refresh the existing app link. Check two different profiles, then Book a job > select customer > Continue to booking. Check the selected name above the date/time fields.

Keep the existing admin deployment private (Only myself); keep its URL.
Keep Code.gs and the existing customer intake/sync add-ons in place.
Do not paste these files into the separate public customer form project.

The repair fills blank Enquiry IDs for named rows and converts numeric IDs into text without changing their value. It checks Quotes column B is Customer and column V is Enquiry ID before writing. It changes only affected ID cells, and sends no messages or calendar invitations.

If it reports duplicate IDs, stop and send the exact error and affected Enquiry ID cells for review. Existing duplicate references cannot be reassigned safely without inspecting linked bookings, keys and preferences. No duplicate IDs are changed by this repair.

Tests: script initialisation; distinct manual and system customer profiles; numeric and zero IDs; missing/duplicate reference handling; job/quote picker; desktop/mobile customer clicks; existing reference preservation; repeat-run safety; sheet schema and owner checks. All use fictional records. No real bookings were created and no live customer records were inspected.
