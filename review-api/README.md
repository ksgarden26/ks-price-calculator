# KS Garden Services — Reviews and Owner Replies

This feature adds a public 1–5 star review form, public replies labelled "Response from Karl – Owner, KS Garden Services", private admin sign-in, optional opt-in customer email, and new-review email notifications to info@ksgardenservices.co.uk.

## STATUS: Source implemented; Cloudflare setup and deployment required

These files are committed to the GitHub website project, but **do not automatically activate on the live website**. The website must publish the static files in the preview directory, and the API Worker needs a database, secrets, email provider and routes.

## Cloudflare setup

1. Make sure the website publishes preview/reviews.html, preview/reviews.js, preview/reviews.css, preview/review-admin.html and preview/review-admin.js at its web root. If the site uses an extensionless /reviews path, verify its rewrite rules. The admin page should be accessible at /review-admin.html.
2. Open a terminal in this review-api directory, authenticate with Cloudflare, and create D1:

    npx wrangler login
    npx wrangler d1 create ks-reviews

3. Enter the returned D1 database ID in wrangler.toml, replacing the placeholder.
4. Apply the schema:

    npx wrangler d1 execute ks-reviews --remote --file=./schema.sql

5. Set three secrets using the Cloudflare prompt. ADMIN_PASSWORD should be unique, 16+ characters. SESSION_SECRET should be independently random. RESEND_API_KEY must be generated in a Resend account after verifying your sending domain.

    npx wrangler secret put ADMIN_PASSWORD
    npx wrangler secret put SESSION_SECRET
    npx wrangler secret put RESEND_API_KEY

   Do NOT commit these secret values to GitHub.

6. Check REVIEW_FROM_EMAIL, NOTIFY_TO_EMAIL and REVIEW_ADMIN_URL in wrangler.toml. Email sending requires the sending address and domain to be verified with Resend. Notification emails are addressed to info@ksgardenservices.co.uk.
7. Uncomment and adjust the Cloudflare routes for ksgardenservices.co.uk/api/reviews* and www.ksgardenservices.co.uk/api/reviews*. Verify that this site/domain is in the Cloudflare account before deploying. Both the public reviews page and API must use the same hostname.

    npx wrangler deploy

8. Test one-star and five-star submissions, email receipt, owner login, posting/editing replies, and optional customer email after opt-in.

## How it works

- Public: GET /api/reviews and POST /api/reviews.
- Owner: POST /api/reviews/admin/login (12-hour signed HttpOnly cookie).
- Owner: GET /api/reviews/admin (includes private fields).
- Owner: PUT /api/reviews/admin/REVIEW_ID/reply.
- Owner: POST /api/reviews/admin/logout.
- Public reviews contain original star ratings and text. Owner replies are displayed underneath. No one-star reviews are filtered out.
- Private customer email addresses are never returned through the public reviews API.
- Bot protection includes a hidden field and a hashed-IP submission cooldown. Admin login has a lockout after failed attempts. Cloudflare WAF/Turnstile should be added before high-traffic launch.
- If an email notification fails, the review is saved and notification_sent=0 appears in the owner dashboard. It is not automatically retried.
- Customer email replies can be requested by the owner only when the reviewer gave an email address and explicitly opted in.
- Existing hand-entered testimonials are not imported automatically. Only copy previously approved genuine reviews with permission.
- Update the published privacy notice alongside this feature and provide a route for handling access/deletion requests under UK GDPR.

## Important deployment distinction

The GitHub repo contains a preview folder and a separate price calculator at the root. This new API does not replace the existing website Worker. It should be deployed to the API route in the same Cloudflare zone, alongside the existing site. Connecting the GitHub repository is not the same thing as connecting or administering the Cloudflare account.
## Unified owner dashboard (added 10 October 2026)

The new dashboard is `preview/admin.html` and combines:
- **Reviews:** public replies for existing CJ, Margaret, Abbie, Peter and Alex reviews *without email addresses*, plus replies to future 1–5-star website reviews.
- **Photos:** iPhone camera upload (resized to JPEG), edit photo titles/captions, remove uploads. Images stored in a private Cloudflare **R2** bucket; public images served through read-only Worker media routes.
- **News & advice:** create/edit/publish/unpublish and remove articles. The existing 8 October Cornish lily story lives as fallback data in `preview/news-data.json`, and can be overridden or unpublished from the dashboard without altering original historical HTML.
- **One owner login:** Cloudflare `ADMIN_PASSWORD` and `SESSION_SECRET` sign the session for the whole `/api/` section. The older `preview/review-admin.html` can redirect to this dashboard.

### Additional activation steps
1. Upload the updated `preview/` static files to the **live website**, including `admin.html`, `admin.js`, `admin.css`, `admin.webmanifest`, `legacy-reviews.js`, `news.js`, `news-data.json`, and the updated gallery/review/news HTML and scripts. Direct commits to GitHub are not evidence of a live deployment.
2. For **a new D1 database**, apply the latest `schema.sql`. For an **existing D1 database**, apply only the new `admin-migration.sql` in the D1 SQL console or using `npx wrangler d1 execute ks-reviews --remote --file=./admin-migration.sql`.
3. Create a private **R2 bucket** named `ks-garden-photos` in Cloudflare. Uncomment its `PHOTO_BUCKET` binding in `wrangler.toml`. R2 may require account billing activation.
4. Change the two Cloudflare Worker route patterns to `ksgardenservices.co.uk/api/*` and `www.ksgardenservices.co.uk/api/*` as documented in `wrangler.toml`. This route is required for all admin features, not just reviews. Confirm it does not overlap existing active API routes before deploying.
5. Configure `ADMIN_PASSWORD` and `SESSION_SECRET` privately through Cloudflare Worker secrets, never in source or chat. `RESEND_API_KEY` is optional for replying on-screen, but **required** for review email alerts.
6. Run `npx wrangler deploy` from `review-api/`. From the published site test `GET /api/admin/session` (should return 401 while logged out), `GET /api/reviews`, `GET /api/news`, `GET /api/gallery` (JSON).
7. Sign in from `/admin.html` and test a reply to an existing review, 1 JPEG upload, creation/edit of a news post, and sign-out. Confirm public pages display updates without exposing private reviewer email addresses.

### Important: earlier gallery manager
The separate `preview/gallery-manager/` app uses a GitHub personal access token and edits `preview/gallery-data.json`. The unified dashboard stores **new** photo uploads in Cloudflare R2 instead. The public gallery combines both sources, so existing photos do not need reuploading. Previously uploaded GitHub photos may continue to be edited using the old gallery manager.

### Security and privacy
No admin password, database ID or email API key is committed in the public source. The admin page itself is visible at a public URL, but all updates require a valid signed owner session. Do not treat the page URL as authentication. Customer reviews stay intact and owner replies are saved independently. The editor is not an integration for Google or Facebook native reviews.

## Mobile quoting & measuring (added 10 October 2026)

The private dashboard has a **Quotes & measuring** tab, backed by `preview/quote-builder.html`, `preview/quote-builder.js` and `preview/quote-builder.css`. It is designed for iPhone and iPad, and also works in desktop browsers.

**What it can do**
- Add measured rectangles, triangles and trapeziums; subtract obstructions/planting beds. Automatically total m².
- Upload an *approximately overhead* driveway photograph, tap the two ends of a measured reference length in the same plane, then tap around the work area to calculate an **approximate** polygon area.
- **Photo-traced area is not an AR/LiDAR measurement, not perspective corrected and not survey-grade.** A single photo with arbitrary perspective is unsuitable for reliable area without proper mapping. Measure with a tape or laser on site before committing prices.
- Calculate charges for pressure washing, weed treatment, re-sanding, sealing, pre-treatment, extra labour, materials, disposal, internal travel, discounts and optional VAT.
- Work out sand kilograms and sealer litres/tubs from **user-entered product coverage**; these are planning quantities, not verified supplier specifications.
- See a customer-facing quote preview which rolls internal travel into site costs rather than listing it as a separate travel fee; print/save a PDF or copy the text to WhatsApp/email.
- Save, edit, view and delete confidential quotes in Cloudflare D1 via the **same signed admin login**. No customer data is placed in website localStorage.

**Deployment**
1. Publish updated `preview/admin.html`, `admin.js`, `quote-builder.html`, `quote-builder.js`, `quote-builder.css`, plus previous admin static assets.
2. For a fresh D1 database use the current `schema.sql`; for an existing database run the latest `admin-migration.sql`, which now includes the `quotes` table.
3. Deploy updated `review-api/src/index.js` to the **/api/** routes on the active Cloudflare zone.
4. Verify `GET /api/admin/session` is 401 while signed out; then log in at `/admin.html`, choose **Quotes & measuring**, save a quote, refresh, load it, and test print and copy.
5. Check the phone/tablet layout in portrait and landscape. The iframe resizes itself to fit the app content.

**iPhone/iPad home screen:** Open the published `https://ksgardenservices.co.uk/admin.html` in Safari → Share → **Add to Home Screen**. This places a shortcut on the device. Admin saving, photo uploads, news edits and quote retrieval still **need an internet connection**; this is not an offline-first native app.

**Safety/pricing:** Prices are all editable and initially blank. Do not treat this as a verified automatic price schedule, precise AR measurement, or a connection to Xero. VAT is zero unless explicitly entered, and should be charged only when legally appropriate. Verify surface/product suitability, disposal terms, labour, materials and site conditions.
