# slippingwebsite

Web frontend for [slippage-labs](https://github.com/AbhiBattini/slipping) — paste a
Polymarket or Kalshi URL and an order size, get honest slippage numbers.

## Stack

- **Frontend:** Next.js 14 (App Router) + Tailwind, deployed on Vercel
- **API:** Python serverless function at `api/slippage.py` that imports
  `slippage_labs` and returns its standard JSON payload

## Local dev

```bash
npm install
npm run dev
```

The Python function only runs under `vercel dev` (or in production). For
end-to-end local testing:

```bash
npm i -g vercel
vercel dev
```

## Deploy

Push to the branch and connect the repo in Vercel. Vercel auto-detects Next.js
and the Python runtime from `vercel.json` / `api/requirements.txt`.

## API

`POST /api/slippage`

```json
{
  "url": "https://polymarket.com/event/...",
  "budget": 500,
  "threshold": 2,
  "side": "both",
  "reference": "mid",
  "market": null
}
```

Returns the same JSON schema as `slippage-labs --json`.
