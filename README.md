# LaunchProof AI

LaunchProof AI is a rules-first meme coin screening MVP. It compares promotional claims supplied by a user with available report signals and clearly labels unavailable evidence.

The current MVP validates address shape, extracts recognizable promotional claims, returns deterministic unknowns when external evidence is unavailable, and optionally uses a server-side Gemini or Groq provider to produce a constrained summary.

It does not verify token existence, holder data, liquidity, taxes, permissions, audits, identities, safety, or future performance unless a compliant data adapter is added.

## Files

- `index.html` — static homepage and form
- `privacy.html` — privacy notice
- `terms.html` — terms and limitations
- `css/style.css` — shared styles
- `js/app.js` — browser validation, API request, fallback, rendering, and share-card download
- `api/generate.js` — Vercel-compatible serverless API
- `vercel.json` — security and content-type headers
- `.env.example` — server-only configuration template
- `robots.txt` — crawler directives
- `sitemap.xml` — stable-page sitemap
- `og-image.svg` — social preview source asset
- `favicon.svg` — favicon
- `.nojekyll` — GitHub Pages compatibility marker

## Requirements

- Node.js 18 or newer
- Vercel CLI for local serverless development
- No runtime npm dependencies

## Local development

Install Vercel CLI if needed:

```bash
npm install --global vercel
```

Copy the environment template:

```bash
cp .env.example .env.local
```

Run syntax checks:

```bash
npm run check
```

Run the local Vercel server:

```bash
npm run dev
```

The API is available at:

```text
http://localhost:3000/api/generate
```

## Provider configuration

The safest default is deterministic mode:

```env
AI_PROVIDER=none
```

To enable a provider, select exactly one:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-server-side-key
```

or:

```env
AI_PROVIDER=groq
GROQ_API_KEY=your-server-side-key
```

Never add provider keys to frontend JavaScript or variables with `NEXT_PUBLIC_`, `VITE_`, or equivalent client-exposed prefixes.

Invalid providers and missing keys fail closed to the deterministic report rather than throwing during a request.

## GitHub Pages compatibility

GitHub Pages is static hosting and cannot execute `api/generate.js`.

The frontend remains usable through its deterministic browser fallback. To call an externally deployed API, define an explicit API origin before loading `js/app.js`:

```html
<script>
  window.LAUNCHPROOF_API_URL = "https://approved-api.example/api/generate";
</script>
<script src="js/app.js"></script>
```

The external API must provide:

- HTTPS
- POST handling
- CORS restricted to approved GitHub Pages origins
- The same request and response schema
- Rate limiting
- Server-side provider keys

Do not use a wildcard CORS policy in production.

Asset and navigation paths are relative so the site can run at a GitHub Pages project path.

## SEO and deployment URLs

The project intentionally does not hardcode an unverified production domain. Canonical metadata and absolute sitemap URLs should be added by the deployment process only after the PM approves the production origin.

The repository’s sitemap uses relative locations so it can run on root hosting and GitHub Pages project paths. Before submitting it to search engines, replace those locations and the `robots.txt` sitemap line with the approved absolute HTTPS origin.

The same approved origin should be used consistently for:

- Canonical links
- Open Graph `og:url`
- Open Graph image URLs
- Twitter image URLs
- Sitemap locations
- Robots sitemap directive
- Downloaded share-card branding

## API request

Example:

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "base",
    "address": "0x0000000000000000000000000000000000000000",
    "promo": "Fair launch and liquidity locked."
  }'
```

The address must match the selected chain’s basic format.

## API behavior

- `POST` is required.
- `OPTIONS` is supported for configured CORS origins.
- Non-JSON content types return `415`.
- Oversized requests return `413`.
- Invalid bodies or addresses return `400`.
- Excessive requests return `429`.
- Responses use `Cache-Control: no-store`.
- Provider failures return a deterministic report.
- Provider-generated summaries are bounded and rejected when they contain unsupported recommendation language.
- No stack traces or provider keys are returned.

The in-memory limiter is best-effort and protects a single serverless instance. Durable production rate limiting requires a shared KV or database service.

## Accessibility

The MVP includes:

- A skip link
- Semantic headings
- Associated labels
- Keyboard-focus styles
- Live status messaging
- A busy report region
- Focus management after report generation
- Textual status labels in addition to color

Run manual keyboard and screen-reader checks before launch.

## Security notes

- Treat all user and provider text as untrusted.
- Render user-controlled strings through escaping.
- Do not add secrets to the repository.
- Do not claim external evidence that was not actually checked.
- Keep missing evidence as unknown or unavailable.
- Do not call a project safe, fraudulent, or a scam.
- Do not provide buy, sell, or profit recommendations.

## Production checklist

Before launch:

1. Approve and verify the production domain.
2. Add absolute canonical and social URLs during deployment.
3. Replace the relative sitemap and robots sitemap line with the approved absolute HTTPS origin.
4. Deploy the API to Vercel or configure an approved external API origin.
5. Configure `ALLOWED_ORIGINS` for cross-origin hosting.
6. Confirm provider terms permit the intended use.
7. Add durable rate limiting.
8. Test all API error paths.
9. Validate `robots.txt`, sitemap, metadata, and social preview assets.
10. Run accessibility and mobile checks.
11. Run the 50-case evaluation suite.
12. Confirm no secrets or preview domains appear in shipped files.
