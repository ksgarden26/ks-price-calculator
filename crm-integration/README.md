# KS Garden Services — CRM booking + Google Calendar integration (draft)

**Not deployed or linked to live CRM yet.** This is an implementation package prepared against the copy of the CRM source from the user's Drive (`KS_Garden_Services_CRM_AppScript/Code.gs` and `Index.html`, dated 1 October 2026). The current deployed Apps Script may differ. Do not paste over newer work without comparing.

## What this creates after deployment

Within the **private Quote CRM**, open an existing enquiry. Two **separate actions** are available:

- **Book quote visit:** one-time viewing/assessment in Google Calendar, optional invitation to customer, status remains *Site Visit / Photos Needed* or its existing stage (NOT Won)
- **Confirm agreed job:** appointment for actual accepted work; marks customer enquiry *Won* after Calendar event is created

For accepted work, choose a first date, visit window and recurrence:

- One-off booking → one Google Calendar event
- Weekly / every two, three or four weeks / monthly → one recurring Google Calendar series, with a limited visit count (2–52)
- Calendar account: `info@ksgardenservices.co.uk` (the verified connected business primary calendar)
- Creates a row in a new **Bookings** worksheet, with Booking Type `quote` or `job`. Only confirmed work marks the enquiry **Won**.
- Sets a pop-up reminder for the owner 24 hours in advance
- Optionally invites the customer's saved email address via a **Google Calendar invitation**, only when its checkbox is ticked
- Checks booking references and existing confirmed maintenance series to avoid accidental duplicates

**Quote sending:** the CRM already has a **Quote Sent** status, but the quoting/email process is not yet a fully automated customer acceptance flow. Confirm accepted jobs only after the customer has agreed.

**Not included yet:** rescheduling/cancelling events, an automated customer SMS reminder system, one unified Cloudflare authentication bridge, or Xero invoicing. The Apps Script booking UI is the booking source of truth. The standalone `.ics` calendar-invite builder is separate and should NOT also be used for the same booking if you are inviting a customer directly from Google Calendar.

## Installation: owner-only CRM script

1. **Security first:** Use a **private, owner-only Apps Script project** for customer records and Calendar permissions. If your existing CRM project has a public `Anyone` website-intake deployment, do **not** install the Calendar add-on into that publicly deployed project. Move the public intake handler into its own separate, least-privilege Apps Script project first. This must be reviewed in the live configuration.
2. Open the existing private CRM Apps Script editor from **[KS Garden Services – Quote CRM](https://docs.google.com/spreadsheets/d/1OBGz9VKwv_Aog0H6rpPkUZLtAm3etHIx6YPL1Rr2dIM/edit)** using Extensions → Apps Script.
3. Compare the live `Index.html` with this updated `crm-integration/Index.html`. If it still matches the early October source, replace it with the updated file; otherwise carefully merge the confirm-booking button, form, and JavaScript.
4. Add a new Apps Script file **BookingAddon.gs**; paste `crm-integration/BookingAddon.gs` into it. Keep the existing Code.gs, which provides `CFG.SPREADSHEET_ID`, `getLeads()` and `saveLead()`.
5. In Apps Script → Project Settings, set timezone to **Europe/London**. Under Script Properties, add `KS_OWNER_EMAIL` with the account email used to sign into the private CRM (the owner must actually sign in using this address). No password is stored in the scripts.
6. In Project Settings, verify the new project is authorised for Google Calendar and Google Sheets. Re-authorise on first run as prompted. Deploy a **new version** of the private web app with **Execute as: Me** and **Who has access: Only myself**.
7. Test first on a **test enquiry** and invite only an email address you control. Verify a **quote visit** booking (CRM stays open, not Won), then use **Quote Sent** status after sending a quotation, then confirm a **one-off agreed job** (CRM changes to Won) and a **regular series** (recurring Calendar event). Verify: **Bookings** sheet records show type → Calendar shows separate quote/work events → optional invitation arrives → 24-hour reminder configured. Test fortnightly recurrence across BST/GMT. Check that pressing Confirm twice doesn't create a duplicate. Check error handling and recovery before live customer use.
8. In the proposed KS Admin **Appointments** tab, enter your **private** Apps Script `/exec` web app URL and save the shortcut on your phone/tablet. The shortcut opens the private CRM where you confirm. This does **not** silently share Google credentials or link the underlying databases. The Google authentication still happens in Apps Script.

## Constraints and precautions

- **Calendar conflicts:** this version does not yet reliably detect clashes across the entire recurring series; check the diary before confirming.
- **Never expose** `confirmGardenBooking`, `getLeads`, or `saveLead` via a public or anonymous Apps Script deployment. `Session.getActiveUser().getEmail()` is used as an additional fail-closed owner check, but it is not a substitute for separate private and public projects.
- The Google connected calendar shown to ChatGPT is not automatically authorised for your website or Apps Script. The Apps Script owner account must separately grant Calendar permissions.
- Once Google Calendar event is confirmed, the returned iCalUID is stored in the **Bookings** sheet. If the calendar request fails after creation, the row remains **Needs review** and requires manual inspection before retrying to prevent duplicates.
- A whole recurring series should not be shifted just to move one weather-affected visit. Use Google Calendar to edit **that occurrence only**, and notify the customer separately. Dedicated reschedule/cancellation sync should be developed before treating this as a full dispatch system.
- Invitations may disclose customer address and details to guest recipients. Confirm the email address before ticking the invite box.
