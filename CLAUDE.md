# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Velac is an AI-powered tool for hospitality businesses in Galicia (Spain) to auto-generate responses to online reviews. It targets Ferrol, Galicia specifically. Three available tones: Profesional, Colegueo, Orgullosa.

## Architecture

Two independent services:

- **`/backend`** — .NET 9 Web API (C#), runs on `http://localhost:5146`
- **`/frontend`** — Next.js 16 + React 19 (TypeScript), runs on `http://localhost:3000`

### Backend flow

`ReviewController` → `IReviewAiService` → `ClaudeService` (Anthropic SDK v5.10.0)

The controller receives a `ReviewRequest` record (`ReviewText`, `BusinessTone`, `BusinessDescription`) and delegates to `ClaudeService`, which calls `GetClaudeMessageAsync` with a system prompt tailored to the business context.

The AI model is configured via the `AI_MODEL` env var (defaults to `claude-3-5-sonnet-latest`). Per the Cursor rules, the intended model is **Claude 4.6** (`claude-sonnet-4-6`).

### Key backend patterns

- Dependency injection: register new services in `Program.cs` using `AddScoped`
- Interfaces live in `/backend/Interfaces/`, implementations in `/backend/Services/`
- Secrets come from a `.env` file in `/backend/` loaded via `DotNetEnv` at startup — never hardcode keys

### Frontend notes

> **Important:** This project uses Next.js 16 / React 19, which have breaking changes from earlier versions. Before writing any frontend code, read the relevant guide in `frontend/node_modules/next/dist/docs/`. Heed deprecation notices.

- Use Tailwind CSS (v4) and functional React components
- Secrets go in `frontend/.env.local`

## Commands

### Backend

```bash
cd backend
dotnet run              # Start dev server (http://localhost:5146)
dotnet build            # Build
dotnet watch run        # Hot-reload dev server
```

### Frontend

```bash
cd frontend
npm run dev             # Start dev server (http://localhost:3000)
npm run build           # Production build
npm run lint            # ESLint
```

## Environment Variables

**Backend** (`/backend/.env`):
```
ANTHROPIC_API_KEY=...
AI_MODEL=claude-sonnet-4-6
```

**Frontend** (`/frontend/.env.local`): add frontend-specific vars here.

## API

`POST /api/review/generate`
```json
{
  "reviewText": "La comida estaba fría.",
  "businessTone": "Enxebre",
  "businessDescription": "Restaurante familiar en Ferrol"
}
```
Returns: `{ "response": "..." }`

CORS is configured to allow `http://localhost:3000` only.
