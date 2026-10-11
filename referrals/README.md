# KS Garden Services — New Customer Details (word-of-mouth referrals)

**STATUS: Draft source only. Not deployed; there is no working customer link yet.** This feature deliberately runs as a **standalone Google Apps Script web app**, so the customer can use it on their phone without making an account, even if the Cloudflare/GitHub preview build is failing. It is not a general website signup page or customer portal.

## Desktop and mobile use

The **same web-app /exec URL** works on desktop, laptop, iPad and phone, without a customer app install. On desktop the form has a centred two-column layout; on phones it collapses to a single column. The exact KS Garden Services round logo is embedded in the form, so there is no external logo link to break. Once deployed, each submitted record is stored in the same central Google Sheet and owner notification email is sent regardless of customer device. Only the form, not the private CRM dashboard, is public.

The owner can open their separate private CRM URL on desktop and mobile using their signed-in Google account. The future unified admin dashboard has its own separate Cloudflare password and is not automatically connected to the private CRM until rollout.

## Customer experience

Send the published **private-by-link** form via text, WhatsApp or email to a prospective customer who has been recommended to KS Garden Services. They provide:

- Full name, phone, optional email; preferred contact method (telephone by default)
- **Garden address** (line 1, line 2, town, county, postcode) — always required
- **Billing address same as garden?** — checked by default. Untick to capture a separate billing address; billing name can differ as well
- Invoice delivery — **Email**, **Post** or **No invoice copy needed**. An email is **required** only if Email is selected, or if the customer has separately requested email contact. If no copy is requested, KS **still creates and keeps an invoice in Xero** for its records and can provide a copy on request.
- Service required, notes, who referred them, acceptance of service-contact privacy statement

No marketing opt-in, routine post-visit reports, repeated customer texts or automatic appointment bookings. **Minimal communications remains the default**.

## What gets recorded in the existing CRM

- Appends a `New Enquiry` row to the original **Quotes** tab of the existing [KS Garden Services – Quote CRM](https://docs.google.com/spreadsheets/d/1OBGz9VKwv_Aog0H6rpPkUZLtAm3etHIx6YPL1Rr2dIM/edit). The current 22-column Quotes sheet schema is not changed.
- Sets Source to **Recommendation**, records the garden address, keeps a reference to the referrer and invoice details in Notes, sets a follow-up date on the next workday, and generates a unique Enquiry ID. Owner's existing private daily CRM follow-up reminder can then remind them to contact the customer.
- Also appends a structured record to a new **Customer Details** worksheet in that spreadsheet. This has distinct garden and billing address fields, billing name, invoice delivery, email, service and referral details. It includes `Xero Contact ID` and `Xero Status = Not added` placeholders to allow future owner-authorised matching/sync.
- Tries to send a new-customer-details email to **info@ksgardenservices.co.uk**. If email notification fails after the CRM write, the record remains saved, but notification must be checked manually.
- Repeated immediate submissions from the same customer are deduplicated by a short-lived server cache. The public project can only accept new submissions; it must NOT include private CRM list/read/edit, Calendar access or Xero credentials.

## Deployment instructions (owner action required)

1. Open [Google Apps Script](https://script.google.com/) and create a **new, independent project** e.g. `KS Referral Customer Form`. **Do not add these files to the existing private CRM project or its public website lead endpoint.** This separate project has a strictly submission-only public surface.
2. Paste `referrals/Code.gs` into **Code.gs**. Add an HTML file called **Index**, pasting `referrals/Index.html` into it.
3. In Project Settings set timezone `Europe/London`. Confirm the script refers to the correct spreadsheet ID and business notification address. Do not add a login password or Xero OAuth token to a publicly deployed project.
4. Under Deploy → New deployment → Web app: `Execute as: Me`, `Who has access: Anyone` (so recommended customers can submit without signing in). Authorise access to the existing private spreadsheet and sending owner emails with the business Google account.
5. Copy the **new web app /exec URL**. This is the real customer form link to share directly by WhatsApp/text/email. Avoid listing it prominently on the public site unless you intend all visitors to use it. Anyone who obtains the link can submit a form; it is not an authentication mechanism.
6. Test using **your own contact details**, with `Invoice by Email`, `Post`, and `No copy needed`. Confirm that email is required for emailed invoices, separate billing address fields are required if the checkbox is off, that the private Quotes tab receives Source = Recommendation, and Customer Details receives separate structured billing data. Confirm notification email is received; verify duplicate submits don't create duplicate leads. Delete test rows from the private spreadsheet after verifying.
7. Turn on any anti-spam monitoring (Apps Script executions, quotas, and email delivery). The form includes a honeypot, minimum completion time and a 20-minute deduplication cache but doesn't include a CAPTCHA, so use a link-specific workflow and monitor for abuse.

## Xero hand-off — not yet automatic

- **Do not add every enquiry to Xero immediately.** Once the quote is accepted, the owner checks Xero for an existing contact, then creates or updates it from the structured **Customer Details** data.
- Xero `Name` should use **Billing Name** when supplied, else Customer Name; `EmailAddress` is set if provided; invoice **billing/postal address** comes from billing fields; the garden/service address can be kept as a **street/delivery address**.
- The customer-selected **Invoice Delivery** preference must be followed: Email → send through Xero to stored email; Post → produce invoice, print and post; No Copy → create/record invoice in Xero but don't issue a routine copy, while allowing a copy later.
- **No Xero account is connected and no live Xero contact is created by this draft.** Xero supports creating contacts via its authorised Accounting API and importing contacts using Xero's CSV template. A later *private owner-only* `Create/Match Xero Contact` action should search for duplicates, get explicit owner approval, write the resulting Xero Contact ID back to Customer Details, and avoid changing other existing contacts.
- Xero documentation: https://developer.xero.com/documentation/api/accounting/contacts and https://www.xero.com/uk/accounting-software/organise-contacts/.

**Security note:** The script needs write access to the private CRM spreadsheet to insert records. Its only public business function is `submitReferral`, not the private admin. The spreadsheet URL/ID is not exposed on the customer form. Apps Script has account quotas; test first and do not make a production claim until real entries and emails have been verified.
