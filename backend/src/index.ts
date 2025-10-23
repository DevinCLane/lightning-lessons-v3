import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { neon } from "@neondatabase/serverless";
import { cors } from "hono/cors";
import Stripe from "stripe";
import * as z from "zod";
import { zValidator } from "@hono/zod-validator";
import { Resend } from "resend";

type Variables = {
    // stripe client
    stripe: Stripe;
};

const referrerSchema = z.object({
    firstName1: z.string().nonempty(),
    lastName1: z.string().nonempty(),
    email1: z.email("Invalid email format"),
    firstName2: z.string().nonempty(),
    lastName2: z.string().nonempty(),
    email2: z.email("Invalid email format"),
});

const app = new Hono<{ Variables: Variables }>();
const resend = new Resend(process.env.RESEND_API_KEY);

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

    // this needs to be fixed so that it redirects to lightninglessons.com in prod
    // ...and localhost in dev
    const baseUrl = process.env.BASE_URL ?? "http://localhost:4321";

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
 * Mutual referrer discount
 * Receives two customers names and email from the frontend form
 * Then creates promotion codes specific to those customers
 */
app.post(
    "/mutual-referrer",
    zValidator("form", referrerSchema),
    async (context) => {
        // Retrieve the Stripe client from the variable object
        const stripe = context.var.stripe;

        const baseUrl = process.env.BASE_URL ?? "http://localhost:4321";

        const { firstName1, lastName1, email1, firstName2, lastName2, email2 } =
            context.req.valid("form");
        console.log("successful form submission received");

        // create Stripe customers for each person
        await stripe.customers.create({
            name: `${firstName1} ${lastName1}`,
            email: email1,
        });
        await stripe.customers.create({
            name: `${firstName2} ${lastName2}`,
            email: email2,
        });

        // create the promotion codes for each person
        // to do: how can I make this promo code work only for the upcoming class? Create a coupon just for this product
        // to do: do I want to set a time limit on this?
        // to do: restrict the promo code to this specific customer,
        // ...this requries authentication, or a form where the user submits their email, which is tied to the Stripe customer ID
        // ...which gets passed to the checkout session before the checkout session is created.'
        const uuidBase = crypto.randomUUID().toUpperCase();
        const uuid1 = uuidBase.slice(0, 8);
        const uuid2 = uuidBase.slice(-8);
        const promotionCode1 = await stripe.promotionCodes.create({
            coupon: `${process.env.STRIPE_COUPON_CODE}`,
            code: `${firstName1.toUpperCase()}${uuid1}`,
            max_redemptions: 1,
            // to do: keep this inactive until the referred customer purchases their class
        });
        const promotionCode2 = await stripe.promotionCodes.create({
            coupon: `${process.env.STRIPE_COUPON_CODE}`,
            code: `${firstName2.toUpperCase()}${uuid2}`,
            max_redemptions: 1,
        });

        const { data, error } = await resend.batch.send([
            {
                from: "Devin <mutualreferrer@notifications.lightninglessons.com>",
                to: [email1],
                subject: "⚡️ Your Lightning Lessons promo code",
                html: `<html>
            <head>
                <meta charset="UTF-8" />
                <title>⚡️ Lightning Lessons Promo Code</title>
            </head>
            <body>
                <div>
                    <p>Hello ${firstName1}</p>
                    <p>
                        Your 15% off promo code is <b>${promotionCode1.code}</b>
                    </p>
                    <p>
                        This code is only valid for 1 use, so don't share it
                        with anyone else 😊.
                    </p>
                    <p>
                        <a href="https://lightninglessons.com/classes/write-a-song-using-music-theory/">Sign up here</a>
                    </p>
                    <p>See you in class!</p>
                    <small>Didn't want this email? Reply "stop" to unsubscribe</small>
                </div>
            </body>
        </html>`,
            },
            {
                from: "Devin <mutualreferrer@notifications.lightninglessons.com>",
                to: [email2],
                subject: "⚡️ Your Lightning Lessons promo code",
                html: `<html>
            <head>
                <meta charset="UTF-8" />
                <title>⚡️ Lightning Lessons Promo Code</title>
            </head>
            <body>
                <div>
                    <p>Hello ${firstName2}</p>
                    <p>
                        Your 15% off promo code is <b>${promotionCode2.code}</b>
                    </p>
                    <p>
                        This code is only valid for 1 use, so don't share it
                        with anyone else 😊.
                    </p>
                    <p>
                        <a href="https://lightninglessons.com/classes/write-a-song-using-music-theory/">Sign up here</a>
                    </p>
                    <p>See you in class!</p>
                    <small>Didn't want this email? Reply "stop" to unsubscribe</small>
                </div>
            </body>
        </html>`,
            },
        ]);

        if (error) return context.json(error, 400);

        // to do: save user to database
        // do i want to register that they created a promo code?

        // to do: return them to a success page

        return context.redirect(`${baseUrl}/mutual-referrer/return`);
    }
);

serve(
    {
        fetch: app.fetch,
        port: process.env.PORT ? parseInt(process.env.PORT) : 8080,
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
    }
);
