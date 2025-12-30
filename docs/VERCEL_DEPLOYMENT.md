# Vercel deployment

Project: `apps/vercel-wire-strip`

## Production URL

- https://vercel-wire-strip-cln4iz0gk-somacosfs-projects.vercel.app

## Vercel dashboard

- https://vercel.com/somacosfs-projects/vercel-wire-strip

## Notes

This is currently a static SPA/PWA skeleton (no framework) that renders Mermaid diagrams client-side.

Next steps for a true wire_stripper web app:
- Add an API surface (Vercel serverless routes) that can read exported JSON snapshots (not live SQLite).
- Add an OTLP ingest endpoint (or proxy to an OTel Collector) for live dashboards.
- Add authentication + profile switching.
