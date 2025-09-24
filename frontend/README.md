# Frontend app

## Set up

-   `.env`: set your **public** Stripe API in **PUBLIC_STRIPE_PUBLISHABLE_KEY**
-   `.env.development`: set the URL/port of your local backend server in **PUBLIC_API_URL** (likely http://localhost:8080)
-   `.env.production`: set the URL of your deployed production backend server

    -   The reason for doing this is so that you can easily change backend production environments withou needing to remember where it's referenced in the code.

-   Don't forget to set the environment variables in your production environment (such as Netlify)

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                    | Action                                           |
| :------------------------- | :----------------------------------------------- |
| `pnpm install`             | Installs dependencies                            |
| `pnpm run dev`             | Starts local dev server at `localhost:4321`      |
| `pnpm run build`           | Build your production site to `./dist/`          |
| `pnpm run preview`         | Preview your build locally, before deploying     |
| `pnpm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `pnpm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
