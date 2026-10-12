## Google Maps satellite measuring (private app)

The area-measuring screen can now use **Google Maps satellite imagery** as its first choice. Tapping driveway/patio corners still calculates and saves area in square metres in the existing Measurements sheet. If the Google Maps key is missing or the library cannot load, the earlier Esri satellite-outline map remains available as a fallback.

To activate Google Maps on the private Apps Script admin deployment:

1. Set up a separate Google Cloud project with billing and **Maps JavaScript API** enabled, then create a **browser/websites** API key. See https://developers.google.com/maps/documentation/javascript/get-api-key .
2. Restrict the key to **Maps JavaScript API** and allowed **HTTPS website referrers** determined by the actual Google Apps Script iframe URL (inspect errors like RefererNotAllowedMapError). Do not use an unrestricted key. Set Google Cloud quotas and billing alerts to control spend. Google Apps Script HTMLService may use a shared `script.googleusercontent.com` origin, so website-referrer restrictions can be coarser than on a private website domain; consider a dedicated map page hosted on a KS-owned Cloudflare domain if stronger restrictions are necessary.
3. Add `GoogleMapsAddon.gs` from this feature branch **only to the private CRM Apps Script project** (never the public customer form).
4. In the private Apps Script project, **Project Settings → Script Properties → Add property** `KS_GOOGLE_MAPS_API_KEY` with the Maps JavaScript API browser key. Do not paste keys into GitHub or Index.html.
5. Paste the latest `Index.html` into the same private project, save, then edit the **existing** private deployment → **New version** → Deploy. Keep access **Only myself**.
6. On iPhone Chrome (signed into the KS business Google account), go to Measure Area → Satellite outline. Expect a Google satellite map (and Google imagery credits). Tap points, undo/clear, find postcode and save as usual.

Google Maps JS uses its own key that is necessarily visible in browser network requests; storing it as a script property keeps it out of the GitHub source but **does not make it secret**. Apply API + website restrictions and quotas. The Maps JavaScript API is not the same as the free Google Maps consumer app and requires billing for production use, with monthly free-tier limits. Google satellite imagery resolution differs by address; no software can guarantee property-level detail or survey accuracy.

---

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
- Sets **two Google Calendar pop-up alerts for the owner**: 24 hours before and 1 hour before EVERY booking, including recurring maintenance instances
- Stores a **contact preference per booking**: Phone/landline, SMS, Email, written appointment card, or in-person
- Every enquiry/new customer defaults to **Minimal communications** in the private CRM, stored in a separate **Customer Preferences** worksheet. The selected level stays attached to the customer:
  - **Minimal (default):** no routine appointment messages, calls, post-visit reports, photos or review requests. Only contact when necessary (changes, problems, customer-requested information, billing), or if a message is expressly requested.
  - **Standard/Full:** enables owner-selectable routine communication preferences, but no routine messages are automatically sent by these settings alone.
  - **Optional on-the-day ETA countdown:** separate affirmative opt-in checkbox, independent of level. This is only a stored preference at present; the tracking delivery feature is NOT connected or live.
  - **Post-visit reports:** explicit opt-in checkbox, OFF by default. No automatic report generation/sending is implemented.
  - Internal owner 24h + 1h alerts and daily diary remain ON regardless of customer communication level.
- Provides a **private 7am-ish morning email digest** summarising today's jobs, tomorrow's jobs, quotation follow-ups and tomorrow's customers who have opted for routine contact and need calling/texting/cards (only after installing its trigger). Does not send customer messages.
- Optionally invites the customer's saved email address via a **Google Calendar invitation**, only when its checkbox is ticked
- Checks booking references and existing confirmed maintenance series to avoid accidental duplicates

**Quote sending:** the CRM already has a **Quote Sent** status, but the quoting/email process is not yet a fully automated customer acceptance flow. Confirm accepted jobs only after the customer has agreed.

**Not included yet:** rescheduling/cancelling events, an automated customer SMS reminder system, one unified Cloudflare authentication bridge, or Xero invoicing. The Apps Script booking UI is the booking source of truth. The standalone `.ics` calendar-invite builder is separate and should NOT also be used for the same booking if you are inviting a customer directly from Google Calendar.

## Installation: owner-only CRM script

1. **Security first:** Use a **private, owner-only Apps Script project** for customer records and Calendar permissions. If your existing CRM project has a public `Anyone` website-intake deployment, do **not** install the Calendar add-on into that publicly deployed project. Move the public intake handler into its own separate, least-privilege Apps Script project first. This must be reviewed in the live configuration.
2. Open the existing private CRM Apps Script editor from **[KS Garden Services – Quote CRM](https://docs.google.com/spreadsheets/d/1OBGz9VKwv_Aog0H6rpPkUZLtAm3etHIx6YPL1Rr2dIM/edit)** using Extensions → Apps Script.
3. Compare the live `Index.html` with this updated `crm-integration/Index.html`. If it still matches the early October source, replace it with the updated file; otherwise carefully merge the confirm-booking button, form, and JavaScript.
4. Add new Apps Script files **BookingAddon.gs**, **BookingReminders.gs**, and **CustomerPreferencesAddon.gs**; paste the correspondingly named GitHub files. Keep the existing Code.gs, which provides `CFG.SPREADSHEET_ID`, `getLeads()` and `saveLead()`.
5. In Apps Script → Project Settings, set timezone to **Europe/London**. Under Script Properties, add `KS_OWNER_EMAIL` with the account email used to sign into the private CRM (the owner must actually sign in using this address). Optional `KS_DIGEST_EMAIL` overrides the owner email recipient for the daily brief; otherwise, it sends to `info@ksgardenservices.co.uk`. No passwords are stored in these scripts.
6. In Project Settings, verify the project is authorised for Google Calendar, Google Sheets, Apps Script triggers and email sending. Re-authorise on first run as prompted. Deploy a **new version** of the private web app with **Execute as: Me** and **Who has access: Only myself**.
7. Run `setupKsDailyBookingBrief()` once **as the authorised owner** in the private Apps Script editor, granting permissions. This creates one time-driven trigger to email your morning briefing around 7am London time (Google's clock triggers aren't guaranteed to run at an exact minute). No customers are sent messages. Confirm the trigger in Apps Script → Triggers. Ensure Google Calendar mobile notifications are enabled on your phone or tablet so the 24h and 1h reminders actually appear.
8. Test first on a **test enquiry** and invite only an email address you control. Verify a **quote visit** booking (CRM stays open, not Won), then use **Quote Sent** status after sending a quotation, then confirm a **one-off agreed job** (CRM changes to Won) and a **regular series** (recurring Calendar event). Verify: **Bookings** sheet records show type → Calendar shows separate quote/work events → optional invitation arrives → 24-hour and 1-hour reminders configured, plus the morning email digest (test only with your own address). Test fortnightly recurrence across BST/GMT. Check that pressing Confirm twice doesn't create a duplicate. Check error handling and recovery before live customer use.
9. In the proposed KS Admin **Appointments** tab, enter your **private** Apps Script `/exec` web app URL and save the shortcut on your phone/tablet. The shortcut opens the private CRM where you confirm. This does **not** silently share Google credentials or link the underlying databases. The Google authentication still happens in Apps Script.

## Constraints and precautions

- **Daily email:** A digest is sent only on mornings when there are KS jobs or quote follow-ups in the requested window. It includes client names, addresses and telephone numbers; use only your own secure business inbox. If your existing daily CRM follow-up alert at 8am is already active, note this new 7am digest may overlap. Choose one after testing rather than enabling duplicate alerts.
- **Calendar conflicts:** this version does not yet reliably detect clashes across the entire recurring series; check the diary before confirming.
- **Never expose** `confirmGardenBooking`, `getLeads`, or `saveLead` via a public or anonymous Apps Script deployment. `Session.getActiveUser().getEmail()` is used as an additional fail-closed owner check, but it is not a substitute for separate private and public projects.
- The Google connected calendar shown to ChatGPT is not automatically authorised for your website or Apps Script. The Apps Script owner account must separately grant Calendar permissions.
- Once Google Calendar event is confirmed, the returned iCalUID is stored in the **Bookings** sheet. If the calendar request fails after creation, the row remains **Needs review** and requires manual inspection before retrying to prevent duplicates.
- A whole recurring series should not be shifted just to move one weather-affected visit. Use Google Calendar to edit **that occurrence only**, and notify the customer separately. Dedicated reschedule/cancellation sync should be developed before treating this as a full dispatch system.
- Invitations may disclose customer address and details to guest recipients. Confirm the email address before ticking the invite box.

## Reminders for customers without email or computers

Choose **Phone / landline** while booking an elderly or offline customer. The CRM still creates YOUR Google Calendar event. Their booking is written to the Bookings sheet, with no email invitation. The daily brief shows **CALL CUSTOMER** (with their stored phone number) on the day before each appointment. It is a reminder to you to confirm manually, NOT an automated telephone call. The same system supports text-message, appointment-card and in-person contact preferences. An email invitation can only be selected for a customer whose contact preference is Email and whose address is recorded.

Both one-off quotation visits and confirmed one-off/regular jobs get two popup reminders: 24h and 1h. The new reminder changes are source-only until the owner-only Apps Script integration is installed, tested and enabled. 


## Minimal communication test checklist

- Create a new customer and confirm **Minimal**, daytime tracker OFF and post-visit reports OFF.
- Book a quote visit and a confirmed job: verify the customer's email invitation stays **unticked** and no routine customer messages are sent.
- Verify the customer's chosen preference loads when their CRM record is reopened.
- Select optional daytime ETA tracking on one customer's record: check it remains saved without enabling after-visit reports.
- Check the private morning diary and Google Calendar owner alerts still work for Minimal customers, but routine day-before customer call reminders are skipped.
- A customer selecting full communication does **not** imply automatic consent to marketing emails or automatic post-visit reports; use express choices and comply with applicable contact preferences.


## Private Plant ID on mobile and desktop — draft

**Status: source is in GitHub, not deployed or connected.** Plant identification will NOT work until the private CRM is deployed with a real Pl@ntNet API key.

- In the private CRM's top bar tap **🌿 Plant ID**, then **Take a photo** on iPhone or **Choose from photos** on desktop.
- Camera input requests the rear-facing phone camera when supported; normal gallery selection is also available.
- Select **Auto / Flower / Leaf / Fruit / Bark** and tap **Identify plant**. The browser scales and converts the photo into a compressed JPEG (up to 1,600px wide/tall, under 4MB) before sending it, which also strips original EXIF location metadata. Clear, bright leaf/flower close-ups give better results.
- The **private owner-only** Apps Script function \`identifyKsPlant()\` sends the image to Pl@ntNet using a secret script property \`KS_PLANTNET_API_KEY\`. The key is never embedded in HTML, GitHub files or client-facing endpoints. It requires \`ksBookingOwnerOnly_()\` and must NOT be installed in the public customer referral form/intake project.
- The app shows up to **five probable species**, their Pl@ntNet confidence scores, common English names (where available) and botanical names. English-language API common names are not always the preferred UK names: use the RHS links to confirm.
- Each result includes a link to the RHS plant search for species-specific details and pruning advice. Pruning months and instructions are **not fabricated** from AI image matches.
- Nothing is automatically sent to customers or saved to customer records. The photograph is sent to Pl@ntNet for recognition but is not stored by this CRM feature.
- **Never** use image-ID alone for toxic/edible plant decisions, pesticides, or precise species-dependent pruning.

### Owner activation steps

1. Sign up for a Pl@ntNet developer API key at [my.plantnet.org](https://my.plantnet.org/).
2. In the **private** Google Apps Script CRM project (not its public intake deployment), add \`PlantIdAddon.gs\` from this directory and the latest \`Index.html\`.
3. Under **Project Settings → Script Properties**, add \`KS_PLANTNET_API_KEY\` with the real key. Do not put the key into the website JavaScript.
4. Authorise the script's \`UrlFetchApp\` external-request permission and re-deploy the private CRM /exec as required.
5. Test with a clear photo of a familiar garden plant on iPhone and desktop. Verify common/Latin names and RHS links. Check Pl@ntNet subscription, daily quota and any usage charges.
6. In the owner Cloudflare admin dashboard, the Plant ID tab opens your private CRM shortcut. Save that device's private CRM /exec link under Appointments first. The private CRM and Cloudflare admin remain separate sign-ins in this draft.

Relevant API reference: https://my.plantnet.org/doc/api/identify

**Important security note:** The original CRM can be configured with both public and private deployments of one script project. Do **not** deploy this plant-ID module in a project that is accessible to anonymous customers. Split the public lead-intake and private owner application into separate Apps Script projects before installing a private API key.


## One-tap GPS customer check-in and Garden Passport — draft (11 Oct 2026)

New file **GardenVisitAddon.gs** for the owner-only private CRM, plus the updated private **Index.html**.

- On mobile open the CRM, tap **📍 Check in** or **🌿 Plant ID → Find customer near me**. The browser asks permission to get the device's current position once. There is **no background GPS, persistent tracking or customer location sharing**.
- The private Apps Script checks current GPS against approximate geocodes derived from existing CRM customer address and postcode (Google Maps geocoder). It prioritises customers in the same postcode/outward-code area, ranks potential matches by distance and returns only plausible matches within roughly 120–230 metres depending on device accuracy. On first lookup geocoding several addresses can take a moment; customer address geocodes are cached temporarily (up to six hours) to limit lookups, not appended to your sheet. Reverse GPS postcode and third-party Google address lookup require Maps permission and quotas. Google's geocoding can be approximate.
- Because adjacent addresses or gardens can be very close, **the app never picks or records a customer automatically**. The owner must select and explicitly confirm the correct name. A manual customer picker is always available if location is blocked or inaccurate. The chosen customer's name and time are saved to a new **Garden Check-ins** tab, plus whether the visit was GPS-suggested or manually selected. No raw phone coordinates, background journey history or GPS accuracy data are saved.
- Within Plant ID, once checked in and after identifying a plant, choose the most credible species result and tap **Save this plant to customer's Garden Passport**. The private Google Sheet **Garden Plants** holds the customer record ID, owner-confirmed check-in reference, date/time, English common name, Latin name, family, the suggested identification score and owner notes. The original photo is **not stored**. No customer communications or job-completion reports are triggered by check-in or saving a plant.
- Garden check-in works **without taking a plant photo**. A customer must already be entered in the CRM; if the customer is not there, add the customer in the private CRM first. A plant can only be linked to a verified check-in for that customer, from the previous 12 hours.
- Plant ID's customer list is available on phone and desktop; desktop without GPS simply selects the customer manually.
- It is technically possible that Google Apps Script HTML Service's iframe or a browser denies access to geolocation. This requires **real iPhone Safari and Android Chrome testing after the private project has been deployed**; the manual picker is the fallback. On iOS, allow location for the browser and open the private /exec page directly, not an embedded cross-origin Cloudflare iframe, if permission is blocked.

**Deployment:** Add **GardenVisitAddon.gs** to the secure private CRM Apps Script project alongside Code.gs, BookingAddon.gs, CustomerPreferencesAddon.gs, PlantIdAddon.gs and the updated Index.html. Never place it in the publicly accessible customer-referrals or website lead-intake project. Deploy only for the owner, authorise Maps API, Spreadsheet and Script Cache permissions, and test with your own garden address before checking in at a real customer's garden.

**Tested in draft:** With mocked Apps Script Maps, Sheets and authorised owner, two adjacent customer properties were offered as ranked possibilities. Selecting one created a check-in; a plant identification saved to the chosen customer's Garden Passport; attempting to attach the same check-in to a different customer was rejected. No live device GPS, real geocoding, API key or customer records have been used.
