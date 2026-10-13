# KS Garden Services — Calendar invitation builder

**Status: code prepared for review, not deployed to the live website.**

The appointment-calendar.html and appointment-calendar.js files add an appointment calendar builder to the existing private owner dashboard at `preview/admin.html#appointments`.

## Supports

- One-off visits: a single .ics event
- Regular maintenance: weekly, every two / three / four weeks, or monthly, for a fixed count of 2–52 planned visits
- Flexible arrival **windows** (morning / afternoon / daytime), or agreed exact times
- UK local times (Europe/London), including summer/winter clock changes in recurring invites
- A 24-hour calendar reminder where the customer's calendar application honours VALARM
- An optional appointment address, share sheet with the generated .ics attachment on compatible devices, Google Calendar prefill, and a copyable confirmation message
- No automated emails, SMS, database storage, customer calendar subscriptions, live schedule sync, or connection to Xero/CRM

## Activation

1. Merge this PR into the website source's desired target branch after code review.
2. Publish the **preview/** static website files to the Cloudflare website root, **along with** the existing owner dashboard and secure Cloudflare API. A GitHub commit alone does not publish the live site.
3. Check the owner dashboard still signs in with the existing /api/admin/session endpoint. This builder runs entirely client-side after that dashboard login; the standalone builder URL is also readable publicly but never exposes saved customer data or server-side functionality.
4. On iPhone/iPad in Safari, test one-offs and recurring appointments. The share-sheet should attach the .ics where supported; otherwise download and attach it manually. Check the customer's saved event in Apple Calendar, Google Calendar and Outlook.
5. Try a fortnightly event crossing the March or October UK clock change and verify the local time stays consistent.
6. Check the repeat count matches the visits **actually confirmed**. When one visit changes, customer calendar entries do not update automatically. Contact the customer and send revised details.

## Important limitations

A calendar import is **not** an actual booking system. It does not reserve a slot, track attendance, send reminders by email or text, or reschedule all calendars. To add fully automatic reminders and rescheduling later, integrate server-side appointment records, a verified sender and subscription/invitation updates with stable event IDs and cancellation handling.

Customer details are processed locally within the owner's browser and are not stored by this feature. Calendar files that the owner shares may contain the customer's property address. They should only be sent to the correct customer. Keep visitor and appointment data inside authenticated customer systems; do not commit personal data to GitHub.
