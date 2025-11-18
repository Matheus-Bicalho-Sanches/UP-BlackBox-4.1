# Site-UP Platform

Site-UP is a multi-application platform that combines the public marketing site, the client portal, and the internal operations dashboard used by the UP team. The repository also ships helper services that provide quantitative trading automation, market data ingestion, and an OpenAI-powered assistant for the homepage.

## Highlights
- Next.js 14 front end with Firebase auth, Firestore, and Postgres integrations
- Client portal so investors can follow portfolios, payments, and documents in real time
- Internal dashboard with CRM, tasks, market data, and UP BlackBox operations tooling
- API layer that connects to Asaas billing, Profit data feeds, and UP back office services
- Python services for quant strategies, high-frequency data orchestration, and diagnostics
- Optional Node backend that proxies questions to OpenAI for the interactive homepage hero

## Repository Layout
```
.
+-- src/                  # Next.js application (marketing site, dashboard, portal)
+-- docs/                 # Internal guides and runbooks (mostly Portuguese)
+-- services/             # Python tooling for quant, market feed, and profit bridge
+-- backendhomepagesiteUP # Node service that exposes /ask -> OpenAI
+-- scripts/              # Helper scripts for local setup
+-- public/               # Static assets served by Next.js
+-- data/                 # Sample datasets used by the marketing pages
```

## Requirements
- Node.js 22.x (enforced via package.json "engines")
- npm 9+ (or pnpm/bun if you prefer, but npm is the default in this repo)
- Python 3.11+ for the services in `services/`
- Postgres reachable through `DATABASE_URL` when running dashboard features that read server data

## Getting Started (Next.js App)
1. Install dependencies
   ```bash
   npm install
   ```
2. Copy your environment variables into `.env.local` (see the next section)
3. Start the development server
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000` and edit `src/app/newhome/page.tsx` (the root route re-exports this file)

The build and production commands follow the standard Next.js flow:
```bash
npm run build
npm run start
npm run lint
```

## Environment Variables
Create `.env.local` and add the values you have for each service. The most commonly used variables are listed below.

### Public Firebase client (required for auth/ui)
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Server credentials and integrations
```
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY_ID=
FIREBASE_PRIVATE_KEY=    # remember to keep newline escapes (\n) if pasting a JSON key
FIREBASE_CLIENT_EMAIL=
FIREBASE_CLIENT_ID=
FIREBASE_CERT_URL=
DATABASE_URL=            # Postgres connection string
ASAAS_API_KEY=
ASAAS_ENVIRONMENT=       # production | sandbox
PROFIT_FEED_URL=         # e.g. http://localhost:8001
BACKEND_URL=             # default http://localhost:8000 (UP back office)
NEXT_PUBLIC_BACKEND_ASK_URL= # matches backendhomepagesiteUP deployment, defaults to http://localhost:3001/ask
NEXT_PUBLIC_EXCHANGE_TZ=      # optional, defaults to America/Sao_Paulo
RESEND_API_KEY=               # API key from Resend (https://resend.com) for contact form emails
RESEND_FROM_EMAIL=            # optional, email sender (defaults to onboarding@resend.dev for testing)
CONTACT_EMAIL=                # optional, email recipient (defaults to matheus.bs@up-gestora.com.br)
```

Check any `.env.*` files already present for reference values that you may need in your environment.

## Supporting Services

### Homepage AI backend (`backendhomepagesiteUP`)
This Express service exposes `POST /ask` and forwards questions to OpenAI.
```bash
cd backendhomepagesiteUP
npm install
# .env -> OPENAI_API_KEY=<your key>
npm start
```
Set `NEXT_PUBLIC_BACKEND_ASK_URL` so the marketing hero component can reach this endpoint.

### Python engines (`services/`)
Each folder contains its own README or quick-start guide:
- `services/quant`: Quant strategy engine integrated with UP BlackBox and Firebase
- `services/high_frequency`: Market data ingestion, diagnostics, and maintenance scripts
- `services/profit` & `services/market_feed_next`: Bridges to Profit data feeds and other internal tools

Typical setup:
```bash
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
```
Follow the docs inside each folder for service-specific environment variables, credentials, and run commands.

## Documentation
Inside the `docs/` directory you will find detailed guides (currently written in Portuguese) that cover workflow procedures, bug fixes, and deployment plans for the trading stack.

## Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-change`)
3. Commit with clear messages (`git commit -m "Add my change"`)
4. Push and open a pull request for review

Please also run `npm run lint` before submitting frontend changes, and run the relevant Python test scripts when touching the services.

## License
This project is distributed under the MIT License.
