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