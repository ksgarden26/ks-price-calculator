# KS Garden Services — Website reviews & owner responses

**Implementation:** `preview/reviews.html`, `preview/reviews.js`, `preview/review-admin.html` and this separate Cloudflare Worker API. This system is for **reviews submitted on your own website**, not native Google or Facebook reviews. Those platforms' reviews must be answered on their platforms unless a separately authorised integration is built.

## What it does
- Customers submit a name, optional email, rating **1–5**, and comment.
- A new review is saved as *pending spam check* (regardless of star rating); it is never changed by the owner.
- Email notification to **info@ksgardenservices.co.uk** is attempted for every new review.
- The private admin dashboard lets the owner read reviews, **publish any rating**, and write/edit a public owner reply.
- The customer can opt in to an email alert when Karl responds (requires a supplied email).
- The public page displays published reviews, exact ratings, and their separately labelled owner replies. Private email addresses are never public.
- All admin routes require a strong secret key; submissions have a honeypot and per-day rate limit.

## Cloudflare setup (must be done before this becomes live)
1. Ensure the live website deploy includes the changed `preview/reviews.html`, plus `preview/reviews.js` and `preview/review-admin.html` at equivalent public URLs (for example `/reviews` and `/review-admin.html`). The GitHub repo may not be auto-deployed; confirm the live website points to it.
2. In the same Cloudflare account/zone that hosts the live site, create a **D1 SQL database** named `ks-garden-reviews`. Copy its actual database ID.
3. In this folder, copy `wrangler.toml.example` to `wrangler.toml` (not committed), and replace the placeholder database ID. Configure the `routes` to match the live domain. The more specific `/api/*` routes should attach to this review API Worker without replacing the existing static-site Worker.
4. From this folder: `npx wrangler d1 execute ks-garden-reviews --remote --file=./schema.sql` (or run the SQL via D1 dashboard). Then `npx wrangler deploy`.
5. Generate a random **long** secret, e.g. a 48-byte random hexadecimal string. Store securely: `npx wrangler secret put ADMIN_TOKEN`. **Never paste the key into public HTML, GitHub, or ChatGPT.** Keep it in your password manager. Enter this key only in your website's private admin page.
6. Configure Resend (or replace `notify` with your own transactional email service), verify domain `ksgardenservices.co.uk` and approve the sender `reviews@ksgardenservices.co.uk`. Store the API key using `npx wrangler secret put RESEND_API_KEY`. This is required for actual email notifications.
7. Make sure `ADMIN_URL` matches the working admin page URL. If you use an alias rather than `/review-admin.html`, change it.
8. Test one 5-star and one 1-star review; ensure notification emails arrive, both are visible in admin, both can be published and replied to, and owner responses appear under each original review. Check spam/junk folders for the first email.

**Important:** Adding these files to GitHub alone does **not** create a Cloudflare D1 database, install secrets, verify your email sender, or deploy the API. The public form is concealed when the API is unavailable, to avoid showing a non-functional form.

### Security and fairness
- The admin key is never hardcoded in source and is only kept in browser session storage until the tab session ends.
- All customer text is rendered as plain text, not HTML.
- No email address is displayed in public review responses.
- Ratings are not editable by the owner. A review should not be withheld solely because it is negative.
- Add a line to the privacy notice describing storage/processing of review contact details and email notifications before collecting reviews.
- For production, Cloudflare Turnstile, WAF rate limiting, anti-automation protection, an appropriate retention policy, and an authenticated admin identity system (for example Cloudflare Access) are recommended.

### API
- `GET /api/reviews` published reviews, public fields only.
- `POST /api/reviews` create review (pending) — public.
- `GET /api/admin/reviews` Bearer ADMIN_TOKEN — private reviews.
- `POST /api/admin/reviews/<uuid>/publish` Bearer ADMIN_TOKEN — publish.
- `POST /api/admin/reviews/<uuid>/reply` with JSON `{"reply":"..."}` — save public response.
