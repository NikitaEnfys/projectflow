# ProjectFlow

ProjectFlow is a web-based project management and collaboration application for small teams, agencies and client-based projects.

The system supports organizations, clients, projects, milestones, Kanban-based task management, role-based access control, comments, approval workflows, activity logging and secure task attachments. Internal team members and external clients can use the same application while the backend enforces project-, task- and visibility-specific permissions.

## Main features

- organization and membership management;
- OWNER, ADMIN, PROJECT_MANAGER, MEMBER, CONTRACTOR and CLIENT roles;
- client and client-contact management;
- project-specific client access;
- project and milestone management;
- Kanban task workflow;
- task assignment and status transitions;
- internal and client-visible comments;
- configurable task approval workflow;
- activity log;
- secure task attachments;
- private Supabase Storage integration;
- demo dataset and role-specific demo accounts;
- unit, security-policy and PostgreSQL integration tests.

## Architecture

```text
projectflow/
├── apps/
│   ├── web/        Next.js frontend
│   └── api/        Next.js API
├── packages/
│   └── contracts/  shared contracts
├── scripts/
├── dokumentacio/
├── package.json
└── package-lock.json
```

Main request path:

```text
Browser
   ↓
Next.js Web
   ↓ HTTP
ProjectFlow API
   ↓
Service / permission layer
   ↓
Repository / Prisma
   ↓
PostgreSQL
```

Authentication uses Supabase Auth. ProjectFlow creates its own signed application session token and stores it in an HttpOnly cookie.

Task attachments are validated by the API and stored in a private Supabase Storage bucket. Attachment metadata is stored in PostgreSQL.

## Technology stack

- TypeScript
- Next.js
- React
- Prisma
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Vitest
- ESLint
- Nodemailer

## Requirements

- Node.js 22 or compatible current LTS
- npm
- PostgreSQL database
- Supabase project
- separate PostgreSQL test database for integration tests

## Installation

```bash
npm ci
npm run db:generate
npm run db:migrate
```

Create local environment files from:

```text
apps/api/.env.example
apps/web/.env.example
apps/api/.env.test.example
```

Never commit real credentials.

## Development

```bash
npm run dev
```

Defaults:

```text
Web: http://localhost:3000
API: http://localhost:3001
```

## Supabase Storage

```bash
npm run storage:bootstrap
```

Default private bucket:

```text
projectflow-attachments
```

Allowed attachment types: PDF, PNG, JPEG, TXT and CSV, maximum 10 MB.

## Tests

```bash
npm test
npm run test:integration
npm run lint
npm run build
```

Integration tests require a dedicated `TEST_DATABASE_URL`.

## Demo data

```bash
npm run demo:seed
npm run demo:auth:provision
```

Cleanup:

```bash
npm run demo:auth:cleanup
npm run demo:reset
```

Demo passwords and secrets are provided through environment variables and are not stored in the repository.

## Security

Implemented baseline controls include:

- server-side authorization;
- project-specific client access;
- HMAC-signed application sessions;
- HttpOnly, SameSite and production Secure session cookies;
- request-origin and Fetch Metadata checks;
- CORS allowlisting;
- baseline security headers;
- login/account throttling;
- generic authentication error responses;
- private attachment storage;
- extension, MIME, content-signature and size validation;
- serializable approval transactions with retry on write conflicts;
- API data minimization.

This is a thesis/demo application, not a completed production SaaS. Distributed rate limiting, malware scanning, CSP tuning, HSTS deployment, session revocation, secret rotation and external penetration testing remain future work.
