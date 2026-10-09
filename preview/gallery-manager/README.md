# KS Gallery Manager (iPhone)

A mobile-friendly Progressive Web App (PWA) for the KS Garden Services website.

## What it does
- Select photos or take a photo directly on an iPhone.
- Automatically resize JPEG/PNG/HEIC-compatible images into web-friendly JPEGs (maximum 1800 pixels).
- Upload straight to the GitHub repository as files under \`preview/gallery-images/\`.
- Write/update \`preview/gallery-data.json\`; the public page \`preview/gallery.html\` reads it.
- Manage existing photos, rename jobs/descriptions and remove photos from the gallery.
- Never include a GitHub credential in any committed file.

## Make it open on an iPhone
Publish the main branch from the repository root with GitHub Pages:
Repo Settings → Pages → Deploy from a branch → main → /(root) → Save.
Then open:
https://ksgarden26.github.io/ks-price-calculator/preview/gallery-manager/

In Safari tap Share → Add to Home Screen.

If your Cloudflare deployment uses the \`preview/\` folder as its website root, the same app files may also become available at /gallery-manager/ after deployment. This is not automatic unless your deployment is wired to the GitHub repository.

## Grant upload permission
Generate a GitHub **fine-grained** token:
https://github.com/settings/personal-access-tokens/new
Choose resource owner \`ksgarden26\`, repository \`ks-price-calculator\`, Contents: Read and write. Don't grant more permissions. Use a limited expiration, and save it in a trusted password manager.

The token is held in browser memory only (not localStorage or repository) and has to be entered again when the app is restarted.

## Important
- The repo is public. Every uploaded photo is public; check that you have permission to publish it.
- Removing a photo from the latest branch does **not** erase its Git history.
- iOS may not allow certain HEIC images to decode in all browser versions; export as JPEG if the manager reports a conversion problem.
- Uploads update GitHub immediately, but the customer website only updates when its deployment is configured to build or publish those GitHub changes.
- A direct personal-access-token model is suitable for a single-owner private admin app; for multi-user administration, use a backend with GitHub App authentication.
