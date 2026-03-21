# AI Agent Guidelines for Tiendanube A/B Testing App

Welcome, AI Agent! This file provides essential context, rules, and technical details to help you navigate and contribute effectively to this repository.

## 🎯 Project Ultimate Goal
The objective of this app is to serve as a **Tiendanube Native App** that performs **A/B Testing on product pages**. 

## 🏗️ Project Architecture & State
This is a monorepo containing two main parts:
- **`/api` (Backend)**
  - **Tech Stack**: Node.js, Typescript, Prisma ORM, PostgreSQL.
  - **Purpose**: Handles authentication with Tiendanube API, stores credentials securely, and manages product data/logic. Contains the Tiendanube App Native Template setup.
- **`/frontend` (Frontend)**
  - **Tech Stack**: React.js, Chakra UI (or custom alternatives being explored).
  - **Purpose**: Exposes the visual layer that merchants will use to configure A/B tests inside the Tiendanube admin.
  - **⚠️ IMPORTANT STATE WARNING**: The frontend is currently in the **ideation and creation phase**. It is completely **disposable**. Do NOT over-engineer frontend components, and do NOT worry about backwards compatibility, heavy testing, or strict architectural perfection here entirely yet. Prioritize speed, exploration, and functionality for the MVP.

## 📐 Architecture
**Check the `ARCHITECTURE.md` file at the root of the project to understand the core Tiendanube app flows, DOM manipulation strategies (ScriptTag), and Webhook syncing requirements.**

## 🤖 General Rules for AI Interaction
1. **Understand the "Ideation" context**: Since the frontend is disposable, err on the side of quick, functional prototypes over perfect, scalable architecture right now. 
2. **Backend is more stable**: The backend uses Prisma and Postgres. Any changes to the database schema (`api/prisma/schema.prisma`) require generating new migrations (`npx prisma migrate dev`).
3. **Tiendanube Context**: This app runs inside the Tiendanube Partner Portal. It requires `CLIENT_ID`, `CLIENT_SECRET`, and `TIENDANUBE_API_URL` environment variables to function correctly. Ensure any new integrations consider the existing OAuth and token storage (`UserRepository` / Prisma).
4. **No Placeholder Solutions**: Do not produce half-baked code or placeholders. Provide complete drop-in solutions that work immediately.
5. **Language Consideration**: The user speaks Spanish (`Argentina`), but code, variables, and comments should follow standard English conventions unless the user specifies otherwise.

## 🛠️ Essential Commands
- **Backend Setup & Run**:
  - `yarn setup:api`
  - `yarn start:api`
- **Frontend Setup & Run**:
  - `yarn setup:frontend`
  - `yarn start:frontend`

Always verify that modifications to the API run successfully without breaking the Tiendanube API token refresh and app authorization flow.
