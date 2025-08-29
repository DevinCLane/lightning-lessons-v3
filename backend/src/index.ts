import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { neon } from "@neondatabase/serverless";
import { env } from "hono/adapter";

const app = new Hono();

app.get("/", async (c) => {
    const { DATABASE_URL } = env<{ DATABASE_URL: string }>(c);
    try {
        const sql = neon(DATABASE_URL);
        const response = await sql`SELECT version()`;
        return c.json({ version: response[0]?.version });
    } catch (error) {
        console.error("Database query failed:", error);
        return c.text("Failed to connect to database", 500);
    }
});

serve(
    {
        fetch: app.fetch,
        port: 3000,
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
    }
);
