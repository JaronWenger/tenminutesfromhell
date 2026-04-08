const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();
const db = admin.firestore();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

const ALLOWED_ORIGINS = ["https://hiitem.com", "http://localhost:3000", "http://localhost:3001"];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Max-Age", "3600");
}

// ── Create Checkout Session ──
exports.createCheckoutSession = onRequest(
  { secrets: [stripeSecretKey] },
  async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

    const { uid, email } = req.body;
    if (!uid) { res.status(400).json({ error: "Missing uid" }); return; }

    const stripe = new Stripe(stripeSecretKey.value());

    try {
      const profileSnap = await db.doc(`userProfiles/${uid}`).get();
      let customerId = profileSnap.exists ? profileSnap.data().stripeCustomerId : null;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: email || undefined,
          metadata: { firebaseUID: uid },
        });
        customerId = customer.id;
        await db.doc(`userProfiles/${uid}`).set(
          { stripeCustomerId: customerId },
          { merge: true }
        );
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: "price_1TJmIbLFMveJFmFDrYqKvqyq", quantity: 1 }],
        subscription_data: { trial_period_days: 7 },
        success_url: "https://hiitem.com?checkout=success",
        cancel_url: "https://hiitem.com",
        metadata: { firebaseUID: uid },
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Checkout session error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ── Create Customer Portal Session ──
exports.createPortalSession = onRequest(
  { secrets: [stripeSecretKey] },
  async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

    const { uid } = req.body;
    if (!uid) { res.status(400).json({ error: "Missing uid" }); return; }

    const stripe = new Stripe(stripeSecretKey.value());

    try {
      const profileSnap = await db.doc(`userProfiles/${uid}`).get();
      const customerId = profileSnap.exists ? profileSnap.data().stripeCustomerId : null;

      if (!customerId) { res.status(404).json({ error: "No subscription found" }); return; }

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: "https://hiitem.com",
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Portal session error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ── Stripe Webhook ──
exports.stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

    const stripe = new Stripe(stripeSecretKey.value());
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value()
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const uid = session.metadata?.firebaseUID;
          if (uid && session.subscription) {
            await db.doc(`userProfiles/${uid}`).set(
              {
                isPro: true,
                subscriptionId: session.subscription,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
            console.log(`Pro activated for ${uid}`);
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object;
          const uid = await getUidFromCustomer(subscription.customer);
          if (uid) {
            const isActive = ["active", "trialing"].includes(subscription.status);
            await db.doc(`userProfiles/${uid}`).set(
              {
                isPro: isActive,
                subscriptionId: isActive ? subscription.id : null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
            console.log(`Subscription ${subscription.status} for ${uid}`);
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          const uid = await getUidFromCustomer(subscription.customer);
          if (uid) {
            await db.doc(`userProfiles/${uid}`).set(
              {
                isPro: false,
                subscriptionId: null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
            console.log(`Pro revoked for ${uid}`);
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error("Webhook handler error:", error);
    }

    res.json({ received: true });
  }
);

async function getUidFromCustomer(customerId) {
  const snapshot = await db
    .collection("userProfiles")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}
