# LandEx Backend — MERN Stack

Node.js / Express / MongoDB port of the Java Spring Boot `landex-backend`. Same REST API contract (`/api/v1/*`) so the existing frontend works with either backend.

## Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Framework | Express 4 |
| Database | MongoDB 7 (Mongoose) |
| Cache | Redis 7 |
| Object storage | MinIO / S3-compatible |
| Auth | JWT (access + refresh tokens) |
| Payments | Paynow + Stripe |

## Quick start (local)

```bash
cd landex-backend-mern
cp .env.example .env
# Set all values in .env (MONGODB_URI, FRONTEND_BASE_URL, JWT_SECRET, etc.)

npm install
npm run seed
npm run dev
```

Health: `GET /health` (port from `PORT` in `.env`)

## Docker (full stack)

```bash
cp .env.example .env
# Set all connection URLs and secrets in .env (see comments in .env.example)

docker compose up --build
```

Services: MongoDB, Redis, MinIO, API. All service URLs are read from `.env` only.

## API modules

Mirrors the Java backend:

- **Auth** — register, login, JWT refresh, password reset, email verification
- **Users** — profile, KYC uploads, verification status
- **Buyers** — saved listings, due-diligence checklists
- **Listings** — CRUD, geo search (MongoDB 2dsphere), images
- **Documents** — title deeds, survey plans (S3/MinIO)
- **Verifications** — listing/seller verification workflow
- **Enquiries** — buyer–seller messaging
- **Professionals** — agent/conveyancer directory
- **Payments** — invoices, Paynow, Stripe webhooks
- **Notifications** — in-app inbox + preferences
- **Trust** — public complaints and contact form
- **Admin** — users, listings, payments, analytics, audit logs

## Response format

Same envelope as the Spring Boot API:

```json
{
  "success": true,
  "message": "optional",
  "data": { },
  "timestamp": "2026-07-05T10:00:00.000Z"
}
```

## Differences from Java backend

| Java (landex-backend) | MERN (landex-backend-mern) |
|-----------------------|----------------------------|
| PostgreSQL + PostGIS | MongoDB + 2dsphere geospatial |
| Flyway SQL migrations | Mongoose schemas + seed script |
| Spring Security | Express JWT middleware |
| Spring Boot Actuator | `/health` endpoint |
| SpringDoc Swagger | Add swagger-ui-express if needed |

## Environment variables

See `.env.example` for the full list. Key variables:

- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — min 32 characters
- `PII_ENCRYPTION_KEY` — Base64-encoded 256-bit AES key
- `REDIS_*` — Redis cache (optional for local dev)
- `OBJECT_STORAGE_*` — MinIO/S3 for documents
- `RESEND_API_KEY` — email (optional in dev)

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Production server |
| `npm run dev` | Dev server with `--watch` |
| `npm run seed` | Seed fee schedules |
| `npm run seed:admin` | Create dev admin user (`admin@landex.local` / `Admin123!`) |
| `npm run seed:demo` | Seed demo users, 6 active listings with photos (password `LandExDemo123!`) |
| `npm run seed:all` | Run fee, admin, and demo seeds |

### Listing photos (free on Vercel)

Default `LISTING_IMAGE_STORAGE=mongodb` stores image bytes in MongoDB Atlas (free tier friendly).
No S3 or `uploads/` folder required. Seller uploads work on serverless deployments.
Set `LISTING_IMAGE_STORAGE=object` only when `OBJECT_STORAGE_PROVIDER` is S3/MinIO.

| `npm run smoke` | Run API smoke tests |

## Deploy on Vercel

1. Import `landex-api` repo into Vercel
2. Set **Environment Variables** (Production):

| Variable | Example |
|----------|---------|
| `MONGODB_URI` | Your Atlas connection string |
| `MONGODB_ATLAS_NETWORK_ACCESS` | `0.0.0.0/0` |
| `JWT_SECRET` | min 32 chars |
| `PII_ENCRYPTION_KEY` | Base64 256-bit AES key |
| `FRONTEND_BASE_URL` | `https://your-frontend.vercel.app` |
| `LISTING_IMAGE_STORAGE` | `mongodb` |
| `LISTING_DOCUMENT_STORAGE` | `mongodb` |
| `KYC_DOCUMENT_STORAGE` | `mongodb` |
| `STORAGE_BASE_PATH` | `/tmp/storage` (only if using local disk storage) |
| `OBJECT_STORAGE_BUCKET` | `landex-documents` |
| `NOTIFICATION_FROM_EMAIL` | `dev@landex.local` |

3. In **MongoDB Atlas → Network Access**, allow `0.0.0.0/0` (required for Vercel)
4. Redeploy after env changes

`GET /health` returns `db: "connected"` when MongoDB is reachable.

## Frontend integration

The React app in `../landex` is already wired for API mode:

1. Start this backend: `npm run dev` (default port `8080` from `.env`)
2. Seed an admin user: `npm run seed:admin`
3. In `../landex`, ensure `.env` has:
   - `VITE_USE_API=true`
   - `VITE_API_BASE_URL=http://localhost:8080`
4. Start the frontend: `cd ../landex && npm run dev`

Vite proxies `/api` to `http://localhost:8080`, so the browser can use same-origin requests when `VITE_API_BASE_URL` is set.

## Project structure

```
src/
  config/         Environment and database
  constants/      Enums and role definitions
  middleware/     Auth, upload, error handling
  models/         Mongoose schemas (all entities)
  routes/         Express routers (mirror Java controllers)
  services/       Business logic (mirror Java services)
  seeds/          Database seed scripts
  utils/          Crypto, API response helpers
  app.js          Express application
  server.js       Entry point
```
