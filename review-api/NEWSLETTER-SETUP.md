# The KS Garden Weekly — setup and activation

Status (13 October 2026): Website signup, private subscriber count, Brevo double-opt-in API and optional Sunday campaign scheduler are committed to GitHub. **No live deployment or Brevo connection has been verified.** Signup stays disabled until the API confirms it is fully configured. `NEWSLETTER_AUTO_SEND` is not enabled; no bulk email is currently sent.

## What was added

- `preview/newsletter.html`, `newsletter.css`, and `newsletter.js`: accessible standalone signup, an explicit unticked email consent box, honeypot, and double opt-in UX.
- Inline signup panels on `preview/index.html` and `preview/news.html`, plus navigation/footer links across the static site.
- `preview/privacy.html`: notice for newsletter purposes and the Brevo processor.
- `preview/admin.html` and `admin.js`: owner-only subscriber counter, connection status and last campaign result, sourced from the Brevo list.
- `review-api/src/newsletter.js`: protected Brevo API calls; rate-limited same-origin signup; optional campaign creation and send on Sunday.
- `review-api/newsletter-migration.sql`: hashed-IP rate limiting and per-week campaign log only; subscriber emails remain with Brevo.
- `review-api/wrangler.toml`: Sunday 08:00 UTC cron. This equals 09:00 UK during BST and 08:00 UK in winter.

## Essential setup in Brevo (do not email users before this works)

1. Register/log in at https://app.brevo.com/ and verify `info@ksgardenservices.co.uk` (and your sending domain/DNS records) as a sender. Configure the correct postal/business identity in campaign settings.
2. Create a dedicated contact list named **The KS Garden Weekly**. Record its numeric list ID. Never bulk import CRM/customer emails unless a valid marketing permission basis has been established and recorded.
3. Create and activate a **double-opt-in confirmation email template** in Brevo with a real confirmation link pointing to `{{ params.DOIurl }}`. Record its numeric template ID. Send a test to yourself.
4. Generate a scoped Brevo API key. Keep it secret; **do not paste into GitHub or website HTML**. Add it as a Cloudflare Worker secret called `BREVO_API_KEY`.
5. Set the following **Worker environment variables under the existing [vars] block** of `review-api/wrangler.toml` (the D1 database ID in this repo is also still a placeholder until replaced):
    - `BREVO_LIST_ID = "<numeric list ID>"`
    - `BREVO_DOI_TEMPLATE_ID = "<numeric DOI template ID>"`
    - `BREVO_SENDER_EMAIL = "info@ksgardenservices.co.uk"`
    - `NEWSLETTER_AUTO_SEND = "false"`
    - `NEWSLETTER_NEWS_JSON_URL = "https://ksgardenservices.co.uk/news-data.json"` (change to the public HTTPS URL that **actually serves** `preview/news-data.json` in the live site, test it in a browser first)
6. Make sure the existing `ks-reviews-api` Cloudflare Worker has D1 `DB`, `SESSION_SECRET`, owner login and the correct `/api/*` routes. Do not overwrite the website's frontend Worker or an unrelated CRM API. Apply `newsletter-migration.sql` against the same production D1 database, e.g. from `review-api/`:
    `npx wrangler d1 execute ks-reviews --remote --file=./newsletter-migration.sql`
7. Deploy the API Worker **and** republish the updated `preview/` static files through the existing Cloudflare/GitHub site deployment. A GitHub commit is not proof the website is live. Ensure `/api/newsletter/status` returns `{"configured":true}` only after secrets/database are ready.
8. Test signup with an email address you control: verify the prompt, DOI email delivery, confirmation link, thank-you screen, and that Brevo only counts confirmed contacts. Check private owner dashboard → Newsletter. Test unsubscribe and verify the address no longer receives campaigns.
9. In Brevo, preview a full campaign to yourself before enabling automation. Only when the whole chain works, change `NEWSLETTER_AUTO_SEND = "true"` in the Worker variables and deploy. Review the sending limit on the Brevo account.

## Automatic newsletter sending behaviour

- Cron: Sunday 08:00 UTC, if and only if `NEWSLETTER_AUTO_SEND` is explicitly `"true"`.
- Requires a confirmed subscriber list, verified Brevo sender, valid secret and D1 migration.
- Reads the latest published articles from D1 and `NEWSLETTER_NEWS_JSON_URL` (including unpublished dashboard overrides); uses up to 5 new articles from the previous 7 days, plus a short seasonal tip. Each story links to the live news hub. The email includes a Brevo unsubscribe link.
- If there are no fresh stories or no confirmed subscribers, **no email is sent** that week. This avoids sending repeated, stale issues.
- Stores one campaign claim per UTC Sunday in D1 to prevent double sends if the Cron retries. Failed campaigns are not automatically resent; check Brevo and the owner dashboard manually.
- No subscriber addresses are returned from the owner API or mixed with customer records.

## Troubleshooting

- Signup button disabled: `/api/newsletter/status` is missing, returns not configured, or is blocked by existing route configuration.
- Signup submits but no confirmation email: inspect Brevo DOI template sender, the DOI link, the recipient's spam folder, Brevo API logs, and whether their email already exists in Brevo.
- Count blank: verify owner session, list ID, Brevo API access and D1 migration.
- Cron skips: no new published articles in previous 7 days, no confirmed subscribers, or auto send remains disabled.
- Every mailing must preserve the Brevo unsubscribe link. The consent checkbox must never be pre-ticked. See https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/how-do-we-comply-with-the-pecr-electronic-mail-marketing-rules/
