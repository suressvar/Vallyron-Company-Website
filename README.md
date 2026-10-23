# Vallyron Technologies

A responsive, editorial corporate website using the supplied Vallyron palette and locally hosted Poppins. Static HTML is generated for every page; browser JavaScript is limited to navigation, entrances, FAQ behavior, and the enquiry form. No framework or runtime dependency installation is required.

## Run locally

Requires Node.js 20 or newer.

```text
npm run build
npm start
```

Open http://localhost:4173. `npm run dev` builds and starts the server. Rebuild after editing source files. `npm test` checks internal links, metadata, routing, and enquiry validation.

## Content and styling

- `src/content.mjs`: services, product concepts, editorial drafts, FAQs.
- `scripts/build.mjs`: shared components and page templates.
- `public/styles.css`: responsive layouts and brand styling.
- `public/app.js`: accessible menu, FAQ, entrances, form handling.
- `server.mjs`: local preview and enquiry storage.
- `dist/`: generated static pages and assets.

## Contact handling

The local server validates enquiries, enforces consent, checks the request origin, applies a honeypot and minimum completion time, and rate-limits attempts. Valid submissions are saved to `.data/enquiries.jsonl`, outside the served directory and excluded from version control. No email is sent. The form clearly explains this preview behavior. There is no third-party tracking.

For a public deployment, connect a verified email/CRM destination or durable backend, configure the form's copy, and use infrastructure-level rate limiting. `CONTACT_DATA_DIR` sets the storage directory; keep it outside `dist`. Protect and manage access to stored personal data. A static-only host will need a separate `/api/contact` endpoint; the form reports an error rather than claiming a successful send when the endpoint is missing.

## Before public launch

1. Supply the approved logo, verified metrics, product names and availability, leadership profiles, office details, business email/phone, and LinkedIn URL. The current wordmark and geometric V are original provisional brand artwork.
2. Approve service positioning and editorial drafts. The case study is explicitly a fictional scenario. Product dashboard figures are sample data, not business metrics.
3. Review the draft privacy notice and terms with the appropriate company owner. Confirm the data controller, retention policy, contact details, and applicable obligations.
4. Set `SITE_URL` to the final HTTPS origin before `npm run build`; it controls canonical links, Open Graph metadata, schema URLs, and sitemap entries. The local default is http://localhost:4173.
5. Use an appropriate deployment server and HTTPS. The bundled server binds to localhost for local preview. Static pages can be served from `dist` on a standard host, with a contact backend configured separately.
6. Review `public/social-card.png`, the included sharing image. Replace it with final approved brand artwork if required.

## Implementation notes

The homepage includes every requested content section. Five primary destinations, eight service detail pages, two clearly labeled product concept pages, an insights index and three articles, two draft legal pages, and a custom 404 are included. Product schema is deliberately omitted until real product details are confirmed. Service and organization structured data are included.

The reference sites informed the level of editorial hierarchy and enterprise content clarity only. All layouts, copy, geometric graphics, and sample interfaces here were created for this project.

Hosting registration did not complete because the requested `vallyron-technologies` address was already in use. No existing hosted website was changed.

## Loading behavior

The website opens directly to the homepage header and hero section with zero introductory delay or overlay screen.
