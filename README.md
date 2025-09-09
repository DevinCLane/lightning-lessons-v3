# Lightning Lessons music school

This is a website for the online music school Lightning Lessons

## Tech Stack

-   Frontend:
    -   Astro
    -   DaisyUI
    -   TailwindCSS
-   Backend:
    -   Hono
    -   Postgres database

## 🚀 Project Structure

Monorepo with an Astro app for the frontend, and Hono for the backend. Using pnpm workspaces.

```text
├── backend/
│   ├── src/
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── public/               # Static assets (not optimized by Astro)
│   │   └── images/
│   ├── src/
│   │   ├── components/
│   │   ├── images/
│   │   └── layouts/          # Reusable layouts for Astro
│   ├── astro.config.mjs      # Astro configuration file
│   ├── netlify.toml          # Netlify deployment configuration
│   └── package.json
│
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Deployment story

-   Frontend: Netlify
-   Backend: GCP Cloud run
-   Database: Neon postgres

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command        | Action                                                             |
| :------------- | :----------------------------------------------------------------- |
| `pnpm install` | Installs dependencies                                              |
| `pnpm dev`     | Starts fronend at `localhost:4321` and backend at `localhost:8080` |
