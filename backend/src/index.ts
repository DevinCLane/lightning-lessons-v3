import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { neon } from "@neondatabase/serverless";
import { env } from "hono/adapter";
import { cors } from "hono/cors";
import Stripe from "stripe";

type Variables = {
    // stripe client
    stripe: Stripe;
};

const app = new Hono<{ Variables: Variables }>();

app.use("*", cors());

/**
 * Setup Stripe SDK prior to handling a request
 */
app.use("*", async (context, next) => {
    // Load the Stripe API key from context.
    const { STRIPE_SECRET_KEY } = env<{
        STRIPE_SECRET_KEY: string;
    }>(context);

    // Instantiate the Stripe client object
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
        apiVersion: "2025-08-27.basil",
        maxNetworkRetries: 3,
        timeout: 30 * 1000,
    });

    // Set the Stripe client to the Variable context object
    context.set("stripe", stripe);

    await next();
});

/**
 * setup database (should this move to the middleware for stripe setup or be its own middleware?)
 */
app.get("/", async (context) => {
    const { DATABASE_URL } = env<{ DATABASE_URL: string }>(context);
    try {
        const sql = neon(DATABASE_URL);
        const response = await sql`SELECT version()`;
        return context.json({ version: response[0]?.version });
    } catch (error) {
        console.error("Database query failed:", error);
        return context.text("Failed to connect to database", 500);
    }
});

/**
 * creates a Stripe checkout session and returns the client secret
 */
app.post("/create-checkout-session", async (context) => {
    // Retrieve the Stripe client from the variable object
    const stripe = context.var.stripe;

    const baseUrl =
        context.req.header("Host") === "lightninglessons"
            ? "https://lightninglessons.com"
            : `http://localhost:4321`;

    const session = await stripe.checkout.sessions.create({
        line_items: [
            {
                price: "price_1S8TZdKexSyx8640CMuVHFt8",
                quantity: 1,
            },
        ],
        mode: "payment",
        ui_mode: "embedded",
        return_url: `${baseUrl}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        payment_intent_data: {
            description: `Thanks for joining the class. Here are the instructions:
            https://us06web.zoom.us/j/86946272214?pwd=eYmMoKA1coirS1tBH1X9qqhHVNs5k7.1

            Meeting ID: 869 4627 2214
            Passcode: 464997

            ---

            One tap mobile
            +16694449171,,86946272214#,,,,*464997# US
            +16699006833,,86946272214#,,,,*464997# US (San Jose)

            Join instructions
            https://us06web.zoom.us/meetings/86946272214/invitations?signature=DHWc0WqBGbHuiRRXbx2r5yQkVMR1WngUNiNnW7H9ROU
            `,
        },
    });

    return context.json({ clientSecret: session.client_secret });
});

app.get("/session_status", async (context) => {
    // Retrieve the Stripe client from the variable object
    const stripe = context.var.stripe;

    // nullish coalescing operator to solve typescript error,
    // probably a better way to do this?
    const session_id = context.req.query("session_id") ?? "";

    const session = await stripe.checkout.sessions.retrieve(session_id);

    return context.json({
        status: session.status,
        payment_status: session.payment_status,
        customer_email: session.customer_details?.email,
        customer_name: session.customer_details?.name,
    });
});

serve(
    {
        fetch: app.fetch,
        port: process.env.PORT ? parseInt(process.env.PORT) : 8080,
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
    }
);
