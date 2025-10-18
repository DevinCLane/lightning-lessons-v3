import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { neon } from "@neondatabase/serverless";
import { cors } from "hono/cors";
import Stripe from "stripe";
import * as z from "zod";
import { zValidator } from "@hono/zod-validator";

type Variables = {
    // stripe client
    stripe: Stripe;
};

const subscribeSchema = z.object({
    email: z.string().email("Invalid email format"),
});

const app = new Hono<{ Variables: Variables }>();

app.use("*", cors());

/**
 * Setup Stripe SDK prior to handling a request
 */
app.use("*", async (context, next) => {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

    if (!STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }

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
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
        return context.text(
            "DATABASE_URL environment variable is required",
            500
        );
    }

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
 * displays product details and prices for the frontend
 */
app.get("/get_products", async (context) => {
    // Retrieve the Stripe client from the variable object
    const stripe = context.var.stripe;

    // retrieve the priceId from .env (this might need to be refactored to the Hono / typescript way)
    const priceId = process.env.PRICE_ID;

    if (!priceId) {
        throw new Error("PRICE_ID environment variable is required");
    }

    // expand the product details
    const price = await stripe.prices.retrieve(priceId, {
        expand: ["product"],
    });

    const product = price.product;

    return context.json({ product: product });
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

    const priceId = process.env.PRICE_ID;

    if (!priceId) {
        throw new Error("PRICE_ID environment variable is required");
    }
    // expand the product details
    const price = await stripe.prices.retrieve(priceId, {
        expand: ["product"],
    });

    // is this dangerous?
    // price.product could be a string, Product object, or DeletedProduct
    // should i say if price.product is object, not null, and "metadata" in price.product?
    const product = price.product as Stripe.Product;
    const zoomLink = product.metadata.zoom_link || "no zoom link found";

    const session = await stripe.checkout.sessions.create({
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        allow_promotion_codes: true,
        mode: "payment",
        ui_mode: "embedded",
        return_url: `${baseUrl}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        payment_intent_data: {
            description: `Thanks for joining the class. Here is the zoom link: ${zoomLink}`,
        },
    });

    return context.json({ clientSecret: session.client_secret });
});

/**
 * gets the stripe session status
 */
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

/**
 * email newsletter signup
 */

app.post("/subscribe", zValidator("form", subscribeSchema), async (context) => {
    const baseUrl =
        context.req.header("Host") === "lightninglessons"
            ? "https://lightninglessons.com"
            : `http://localhost:4321`;

    const { email } = context.req.valid("form");
    console.log("successful email received:", email);

    // to do: save email to database
    // to do: add Resend audience contact

    return context.redirect(`${baseUrl}/email-signup/return`);
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
