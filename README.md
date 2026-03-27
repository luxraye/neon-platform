# Neon Platform

Neon is a multi-tenant student management platform for tuition centres, built with Next.js and Supabase.

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Copy and configure environment variables:
```bash
cp .env.example .env.local
```

3. Run development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (recommended, especially for hosted deployments)

Optional scaffold (for future DPOPay activation):
- `DPOPAY_COMPANY_TOKEN`
- `DPOPAY_SERVICE_TYPE`
- `DPOPAY_WEBHOOK_SECRET`

## Deployment on Vercel

This repository includes `vercel.json` with Next.js defaults.

### Steps
1. Import the repository into Vercel.
2. Set the Root Directory to `neon-platform` (if repo root is one level above app).
3. Add all required environment variables in Vercel Project Settings.
4. Deploy.

### Build and Start Commands
- Build: `npm run build`
- Install: `npm install`
- Dev: `npm run dev`

## Architecture Notes

- Product/feature architecture and implementation status are documented in `DNA.md`.
