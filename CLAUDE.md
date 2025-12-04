# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Calories**, an AI-powered nutrition tracking app built with SvelteKit. Users can log meals by photo or text description, track calories/macros, monitor weight, and interact with an AI food assistant.

## Commands

```bash
# Development
bun install              # Install dependencies
bun run dev              # Start dev server (uses Bun)
bun run build            # Production build
bun run preview          # Preview production build

# Code Quality
bun run check            # TypeScript/Svelte type checking
bun run lint             # Run ESLint + Prettier check
bun run format           # Format code with Prettier

# Database
bun run db:generate      # Generate Drizzle migrations from schema
bun run db:migrate       # Run migrations against database
```

## Architecture

### Tech Stack
- **Runtime**: Bun
- **Framework**: SvelteKit with Node adapter
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: better-auth with Google OAuth
- **Payments**: Stripe (optional, for hosted mode)
- **AI**: Vercel AI SDK with AI Gateway (anthropic/claude-haiku-4.5)
- **Storage**: S3-compatible storage for temp meal images
- **UI**: Tailwind CSS v4 + shadcn-svelte (bits-ui)

### Key Directories

```
src/
├── lib/
│   ├── server/           # Server-only code
│   │   ├── schema.ts     # Drizzle database schema (all tables)
│   │   ├── db.ts         # Database connection
│   │   ├── auth.ts       # better-auth configuration
│   │   ├── ai.ts         # Meal/pantry image analysis functions
│   │   ├── tools.ts      # AI assistant tools (10 tools for meal/weight/pantry management)
│   │   ├── prompt.ts     # System prompt builder for assistant
│   │   └── gateway.ts    # AI Gateway setup
│   ├── remote/           # SvelteKit "remote functions" (server commands/queries)
│   │   ├── meals.remote.ts
│   │   ├── weight.remote.ts
│   │   ├── water.remote.ts
│   │   ├── pantry.remote.ts
│   │   └── profile.remote.ts
│   ├── components/       # Svelte components (UI + feature components)
│   ├── stores/           # Svelte stores
│   └── auth.ts           # Client-side auth helpers
├── routes/
│   ├── (app)/            # Protected app routes (main dashboard, account, checkout)
│   ├── (auth)/           # Auth routes (signin)
│   └── api/assistant/    # AI chat streaming endpoint
└── hooks.server.ts       # Auth middleware + request logging
```

### Remote Functions Pattern

This project uses SvelteKit's experimental `remoteFunctions` feature. Server-side logic in `src/lib/remote/*.ts` exports `command()` (mutations) and `query()` (reads) that can be called directly from client components:

```typescript
// In remote file
export const addMeal = command(schema, async (input) => { ... });

// In Svelte component
import { addMeal } from '$lib/remote/meals.remote';
const result = await addMeal({ name: 'Pizza', calories: 500, ... });
```

### Database Schema

Core tables in `src/lib/server/schema.ts`:
- `users`, `sessions`, `accounts`, `verifications` - Auth tables (better-auth managed)
- `profiles` - User settings (goals, units, activity level)
- `subscriptions` - Stripe subscriptions
- `mealLogs` - Food diary entries with date/time
- `weightLogs` - Weight tracking
- `waterLogs` - Water intake tracking
- `foodPreferences` - User dietary preferences/allergies
- `pantryItems` - Kitchen inventory

### AI Assistant

The food assistant (`/api/assistant`) uses streaming with these tools defined in `src/lib/server/tools.ts`:
- `suggestFood` - Suggest meals to log
- `managePreference` - Track dietary preferences
- `queryMealHistory` / `queryWeightHistory` - Lookup user data
- `updateGoals` - Modify calorie/weight goals
- `logWeight` - Record weight entries
- `deleteMeal` / `editMeal` - Manage meal log
- `queryPantry` / `managePantryItem` - Kitchen inventory

### Hosted vs Self-Hosted Mode

The app checks `isHostedMode()` (from `$lib/server/access.ts`) to conditionally enable Stripe integration. Self-hosted deployments work without Stripe configuration.
