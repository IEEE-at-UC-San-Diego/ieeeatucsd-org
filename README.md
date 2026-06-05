# ieeeucsd-dev

Development version of the IEEE UC San Diego student branch website.

## Figma Design

- [IEEE UCSD Website Design](https://www.figma.com/design/AihoR936yUmYrMoCZJ0LF7/UCSD-IEEE?node-id=0-1&t=ajK9lKroQFJbokFS-1)

## Getting Started

Prerequisites:

- [Bun](https://bun.sh) - Fast all-in-one JavaScript runtime & toolkit

### Installation

1. Clone the repository

```bash
git clone https://github.com/IEEE-UCSD/ieeeucsd-dev.git
cd ieeeucsd-dev
```

2. Install dependencies

```bash
bun install
```

### Development

To start the development server:

```bash
bun run dev
```

This will start the server at `http://localhost:4321`. The page will reload automatically when you make changes.

### Production

To build and start the production server:

```bash
bun run build
bun run start
```

### Docker Deployment

The project includes Docker support for all services:

```bash
# Start all services
docker-compose up

# Start specific service
docker-compose up website    # Port 4321
docker-compose up dashboard  # Port 4323

# Build and run a specific service
docker build -t dashboard . --target dashboard
docker run -p 4323:4323 --env-file .env dashboard
```

See [`apps/dashboard/docs/DEPLOYMENT.md`](apps/dashboard/docs/DEPLOYMENT.md) for detailed dashboard deployment instructions.

## Built with:

- [Astro](https://astro.build) - Web framework for content-driven websites
- [React](https://react.dev) - UI components
- [TailwindCSS](https://tailwindcss.com) - Styling
  - This manifests as one line CSS like `class="flex border-white/40 border-[0.1vw] rounded-[2vw] h-[85vh] px-[10%] py-[3%] bg-gradient-to-t to-ieee-blue-100/30 via-ieee-black from-ieee-black"`
- [TailwindAnimated](https://www.tailwindcss-animated.com/)
  - This is what we use for all of our nice animations!
- [MDX](https://mdxjs.com) - Enhanced Markdown
- [Expressive Code](https://expressive-code.com) - Beautiful code blocks
- [Node.js Adapter](https://docs.astro.build/en/guides/integrations-guide/node/) - Server-side rendering

## Contributors:

- Charles Nguyen
- Shing Hung
