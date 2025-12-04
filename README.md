# Calories

A simple, AI-powered nutrition tracking app.

## Features

- **Meal Logging** - Snap a photo or describe your meal to get instant calorie and macro estimates
- **Smart Dashboard** - Track calories, protein, carbs, and fat with visual progress rings
- **Food Assistant** - Get personalized meal suggestions and ask nutrition questions
- **Weight & Water Tracking** - Set goals and track progress with quick-add buttons

## Tech Stack

- [SvelteKit](https://kit.svelte.dev/) - Full-stack framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn-svelte](https://shadcn-svelte.com/) - UI components
- [Drizzle ORM](https://orm.drizzle.team/) - Database
- [Stripe](https://stripe.com/) - Payments

## Getting Started

### Prerequisites

- Bun
- A PostgreSQL database
- AI Gateway API key

### Installation

```bash
# Clone the repository
git clone https://github.com/joeychilson/calories.git
cd calories

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Set up your database
npm run db:push

# Start the development server
npm run dev
```

### Environment Variables

See `.env.example` for required environment variables.

## License

MIT

## Links

- [Website](https://burncalories.app)
- [Landing Page](https://github.com/joeychilson/calories-landing)
