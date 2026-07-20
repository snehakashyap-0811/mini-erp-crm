# Mini ERP + CRM Operations Portal

Full-stack wholesale/distribution ERP + CRM for internal teams (Admin, Sales, Warehouse, Accounts).

## Live demo

| | URL |
|--|-----|
| **Frontend** | https://mini-erp-crm-web.vercel.app |
| **Backend API** | https://mini-erp-crm-api.vercel.app |
| **Health** | https://mini-erp-crm-api.vercel.app/health |
| **GitHub** | https://github.com/snehakashyap-0811/mini-erp-crm |

Password for all demo users: `Password@123`  
(`admin@erp.local`, `sales@erp.local`, `warehouse@erp.local`, `accounts@erp.local`)


## Architecture

```
React (Vite)  --->  Express REST API (TypeScript)  --->  PostgreSQL (Prisma)
     |                        |
  JWT auth              Role-based access
```

| Layer | Tech |
|-------|------|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT + bcrypt |

### Modules
1. **Authentication & roles** — Admin, Sales, Warehouse, Accounts
2. **Customer CRM** — CRUD, search, detail page, follow-up notes
3. **Products & inventory** — CRUD, stock IN/OUT log, low-stock filter
4. **Sales challans** — multi-product, draft/confirm/cancel, stock reduction with snapshot lines

## Test login credentials

Password for all users: `Password@123`

| Role | Email |
|------|-------|
| Admin | `admin@erp.local` |
| Sales | `sales@erp.local` |
| Warehouse | `warehouse@erp.local` |
| Accounts | `accounts@erp.local` |

## Local setup

### Prerequisites
- Node.js 18+ (20+ recommended)
- Docker (for PostgreSQL) **or** a local Postgres instance

### 1. Start database

```bash
docker run -d --name mini-erp-db \
  -e POSTGRES_USER=erpuser \
  -e POSTGRES_PASSWORD=erppass123 \
  -e POSTGRES_DB=mini_erp \
  -p 5434:5432 postgres:16-alpine
```

Or from project root:

```bash
docker compose up -d db
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# DATABASE_URL should point to your Postgres (default uses port 5434)
npm install
npx prisma db push
npm run seed
npm run dev
```

API: `http://localhost:4000`  
Health: `http://localhost:4000/health`

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:4000/api
npm install
npm run dev
```

App: `http://localhost:5173`

### Environment variables

**Backend**
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default 7d) |
| `PORT` | API port (default 4000) |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated |

**Frontend**
| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Backend API base URL (include `/api`) |

## API overview

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/customers` | List / create |
| GET/PUT | `/api/customers/:id` | Detail / update |
| POST | `/api/customers/:id/follow-ups` | Add follow-up |
| GET/POST | `/api/products` | List / create |
| GET/PUT | `/api/products/:id` | Detail / update |
| POST | `/api/products/:id/stock-movements` | Stock IN/OUT |
| GET/POST | `/api/challans` | List / create |
| PATCH | `/api/challans/:id/confirm` | Confirm (reduces stock) |
| PATCH | `/api/challans/:id/cancel` | Cancel (restores stock if confirmed) |
| GET | `/api/dashboard` | Summary stats |

Postman collection: [`postman/Mini-ERP-CRM.postman_collection.json`](postman/Mini-ERP-CRM.postman_collection.json)

## Business rules (challans)

- Confirming a challan **reduces stock**
- Stock **cannot go negative** — API returns `400` with a clear message
- Challan lines store a **product snapshot** (name, SKU, unit price), not only product ID
- Cancelling a **confirmed** challan restores stock

## Role access (summary)

| Area | Admin | Sales | Warehouse | Accounts |
|------|-------|-------|-----------|----------|
| Customers | yes | yes | no | view |
| Products | yes | view | yes | view |
| Stock adjust | yes | no | yes | no |
| Challans create/confirm | yes | yes | view | view |

## Deployment (how this project is hosted)

| Piece | Service |
|-------|---------|
| Database | Neon (PostgreSQL) |
| Backend API | Vercel serverless (`backend/`) |
| Frontend | Vercel static site (`frontend/`) |

### Environment variables (production)

**Backend (Vercel project `mini-erp-crm-api`)**
- `DATABASE_URL` — Neon connection string (prefer pooler URL)
- `JWT_SECRET` — long random secret
- `CORS_ORIGIN` — frontend origin(s), e.g. `https://mini-erp-crm-web.vercel.app`

**Frontend (Vercel project `mini-erp-crm-web`)**
- `VITE_API_URL` — `https://mini-erp-crm-api.vercel.app/api`

### Notes
- Frontend build needs Node 20+ (Vercel project set to 22.x)
- Free serverless cold start may make the first API request slow
- Do not commit `.env` files

## Assumptions

- One warehouse location field per product (string), not multi-warehouse master data
- Purchase orders / invoices PDF are out of scope (assignment core only)
- Soft “Accounts” role is mostly read access for customers/products/challans
- Free-tier hosts may cold-start when idle (first request can be slow)

## Known limitations

- No email notifications for follow-ups
- No product image upload
- No PDF invoice export
- Role permissions are API-enforced; UI hides links but is not the security boundary
- Seed script clears and recreates demo data when `FORCE_SEED=true` is set

## Project structure

```
mini-erp-crm/
  backend/          Express + Prisma API
  frontend/         React admin UI
  postman/          API collection
  docker-compose.yml
  README.md
```
