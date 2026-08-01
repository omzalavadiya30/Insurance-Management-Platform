# Insurance Management Platform

A full-stack web application for managing insurance customers, policies, claims, premiums, documents, and reports.

---

## Tech Stack

### Frontend
- Next.js 16
- TypeScript
- Tailwind CSS
- React Hook Form
- Axios
- Zod
- Chart.js

### Backend
- Node.js
- Express.js

### Database
- PostgreSQL
- Supabase PostgreSQL hosting
- Prisma schema

### Authentication
- JWT authentication
- bcrypt password hashing
- Resend password reset email

### File Storage
- Supabase Storage

### Other Tools
- PDFKit
- Git & GitHub
- Postman

---

## Project Structure

```
insurance-management-platform
│
├── client
├── server
├── README.md
└── .gitignore
```

---

## Installation

### Clone Repository

```bash
git clone <repository-url>
```

### Frontend

```bash
cd client
npm install
npm run dev
```

Runs on

```
http://localhost:3000
```

### Backend

```bash
cd server
npm install
npm run dev
```

Runs on

```
http://localhost:5000
```

### Day 2 Database Setup

Run the SQL in `server/database/day2-database-schema.sql` in your Supabase SQL editor.
It creates:

- `app_users` for registered platform users
- `auth_sessions` for revocable JWT sessions
- `password_reset_tokens` for one-time reset links
- `customers`, `policies`, `premium_payments`, `claims`, `claim_notes`, `documents`, and `audit_logs` for the insurance workflow

The matching Prisma data model is available at `server/prisma/schema.prisma`.

Copy the example environment files before running the app:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

Fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`.

### Authentication API

Base URL:

```txt
http://localhost:5000/api/auth
```

Endpoints:

- `POST /register`
- `POST /login`
- `GET /me`
- `POST /logout`
- `POST /forgot-password`
- `POST /reset-password`

Supported authentication roles:

- `admin` for administrators
- `agent` for insurance agents
- `customer` for customers

---

## Features

- Authentication
- Customer Management
- Policy Management
- Premium Management
- Claim Management
- Document Upload
- Dashboard
- Reports
- Role-based Access Control

---

## Development Schedule

| Day | Task |
|------|------|
| 1 | Requirement Analysis, UI Wireframes, Project Setup |
| 2 | Database Design & Authentication |
| 3 | Customer Management |
| 4 | Policy Management |
| 5 | Premium Management |
| 6 | Claim Management |
| 7 | Document Management |
| 8 | Dashboard |
| 9 | Search & Pagination |
| 10 | Authorization |
| 11 | Validation |
| 12 | Testing |
| 13 | UI Improvements |
| 14 | Deployment |

---

## Folder Overview

### client

Contains the Next.js frontend.

### server

Contains the Express REST API.
