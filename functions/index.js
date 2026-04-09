const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

// ── Email Setup ──
function createTransporter(password) {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: "hiitemhq@gmail.com", pass: password },
  });
}

async function sendEmail(transporter, to, subject, html) {
  try {
    await transporter.sendMail({
      from: '"HIITem" <hiitemhq@gmail.com>',
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`Email failed to ${to}:`, err.message);
  }
}

const emailFooter = `
  <p style="margin-top:32px;font-size:13px;color:#888;">
    — The HIITem Team<br/>
    <a href="https://hiitem.com" style="color:#ff6b2b;">hiitem.com</a>
  </p>
  <p style="font-size:11px;color:#aaa;margin-top:24px;">
    You're receiving this because you have a HIITem account.
    This is a transactional email related to your account activity.
  </p>
`;

const ALLOWED_ORIGINS = ["https://hiitem.com", "https://www.hiitem.com", "http://localhost:3000", "http://localhost:3001"];

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
  { secrets: [stripeSecretKey, stripeWebhookSecret, gmailAppPassword] },
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
            const sub = await stripe.subscriptions.retrieve(session.subscription);
            await db.doc(`userProfiles/${uid}`).set(
              {
                isPro: true,
                subscriptionId: session.subscription,
                subscriptionStatus: sub.status || "active",
                proSince: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
            console.log(`Pro activated for ${uid} (status: ${sub.status})`);

            // Send Pro confirmation email
            const profileSnap = await db.doc(`userProfiles/${uid}`).get();
            const email = profileSnap.data()?.email || session.customer_email;
            const name = profileSnap.data()?.displayName || "";
            if (email) {
              const transporter = createTransporter(gmailAppPassword.value());
              const isTrial = sub.status === "trialing";
              await sendEmail(transporter, email, isTrial ? "Your Pro trial has started!" : "Welcome to HIITem Pro!",
                `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;color:#222;">
                  <h1 style="color:#ff6b2b;font-size:24px;">Welcome to Pro${name ? `, ${name.split(" ")[0]}` : ""}!</h1>
                  ${isTrial
                    ? `<p>Your 7-day free trial is now active. Here's what you've unlocked:</p>`
                    : `<p>You're all set. Here's what you've unlocked:</p>`
                  }
                  <ul style="padding-left:20px;line-height:1.8;">
                    <li>Custom timer colors</li>
                    <li>Shuffle exercises mode</li>
                    <li>Weekly workout schedule</li>
                  </ul>
                  ${isTrial
                    ? `<p>Your trial runs for 7 days. After that it's just $4.99/month — cancel anytime from Settings → Manage Plan.</p>`
                    : `<p>Your plan is $4.99/month. Manage it anytime from Settings → Manage Plan.</p>`
                  }
                  <p><a href="https://hiitem.com" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#ff3b30,#ff6b2b);color:#fff;text-decoration:none;border-radius:24px;font-weight:600;">Open HIITem</a></p>
                  ${emailFooter}
                </div>`
              );
            }
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
                subscriptionStatus: subscription.status,
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
                subscriptionStatus: "canceled",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
            console.log(`Pro revoked for ${uid}`);
          }
          break;
        }

        case "charge.refunded": {
          const charge = event.data.object;
          const customerId = charge.customer;
          if (customerId) {
            const uid = await getUidFromCustomer(customerId);
            if (uid) {
              await db.doc(`userProfiles/${uid}`).set(
                {
                  refunded: true,
                  refundedAt: admin.firestore.FieldValue.serverTimestamp(),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
              console.log(`Refund recorded for ${uid}`);
            }
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const customerId = invoice.customer;
          if (customerId) {
            const uid = await getUidFromCustomer(customerId);
            if (uid) {
              const profileSnap = await db.doc(`userProfiles/${uid}`).get();
              const email = profileSnap.data()?.email || invoice.customer_email;
              const name = profileSnap.data()?.displayName || "";
              if (email) {
                const transporter = createTransporter(gmailAppPassword.value());
                await sendEmail(transporter, email, "Payment issue with your HIITem Pro plan",
                  `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;color:#222;">
                    <h1 style="color:#ff3b30;font-size:24px;">Payment failed</h1>
                    <p>Hey${name ? ` ${name.split(" ")[0]}` : ""}, we had trouble charging your card for HIITem Pro ($4.99/month).</p>
                    <p>Please update your payment method so you don't lose access to Pro features:</p>
                    <p><a href="https://hiitem.com" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#ff3b30,#ff6b2b);color:#fff;text-decoration:none;border-radius:24px;font-weight:600;">Update Payment</a></p>
                    <p style="font-size:13px;color:#666;">Go to Settings → Manage Plan to update your card.</p>
                    ${emailFooter}
                  </div>`
                );
              }
              console.log(`Payment failed email sent for ${uid}`);
            }
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

// ── Welcome Email (on new user profile creation) ──
exports.sendWelcomeEmail = onDocumentCreated(
  { document: "userProfiles/{uid}", secrets: [gmailAppPassword] },
  async (event) => {
    const data = event.data?.data();
    if (!data?.email) return;
    const name = data.displayName || "";
    const transporter = createTransporter(gmailAppPassword.value());
    await sendEmail(transporter, data.email, "Welcome to HIITem!",
      `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;color:#222;">
        <h1 style="color:#ff6b2b;font-size:24px;">Welcome to HIITem${name ? `, ${name.split(" ")[0]}` : ""}!</h1>
        <p>You're all set up and ready to go. Here's what you can do:</p>
        <ul style="padding-left:20px;line-height:1.8;">
          <li>Run timed HIIT workouts with 1-minute intervals</li>
          <li>Create and customize your own workouts</li>
          <li>Track your activity with heatmaps and stats</li>
          <li>Follow friends and share workouts</li>
        </ul>
        <p><a href="https://hiitem.com" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#ff3b30,#ff6b2b);color:#fff;text-decoration:none;border-radius:24px;font-weight:600;">Start a Workout</a></p>
        ${emailFooter}
      </div>`
    );
  }
);

// ── Trial Ending Reminder (runs daily at 9am EST) ──
exports.trialEndingReminder = onSchedule(
  { schedule: "0 14 * * *", timeZone: "UTC", secrets: [stripeSecretKey, gmailAppPassword] },
  async () => {
    const stripe = new Stripe(stripeSecretKey.value());
    const transporter = createTransporter(gmailAppPassword.value());

    // Find subscriptions with trials ending in ~2 days
    const now = Math.floor(Date.now() / 1000);
    const twoDaysFromNow = now + 2 * 24 * 60 * 60;
    const twoDaysPlus1h = twoDaysFromNow + 3600;

    const subscriptions = await stripe.subscriptions.list({
      status: "trialing",
      trial_end: { gte: twoDaysFromNow, lte: twoDaysPlus1h },
      limit: 100,
    });

    for (const sub of subscriptions.data) {
      const uid = await getUidFromCustomer(sub.customer);
      if (!uid) continue;

      const profileSnap = await db.doc(`userProfiles/${uid}`).get();
      const email = profileSnap.data()?.email;
      const name = profileSnap.data()?.displayName || "";
      if (!email) continue;

      // Don't send duplicate reminders
      const alreadySent = profileSnap.data()?.trialReminderSent;
      if (alreadySent) continue;

      await sendEmail(transporter, email, "Your HIITem Pro trial ends in 2 days",
        `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;color:#222;">
          <h1 style="color:#ff6b2b;font-size:24px;">Heads up${name ? `, ${name.split(" ")[0]}` : ""}!</h1>
          <p>Your 7-day Pro trial ends in 2 days. After that, your card will be charged $4.99/month.</p>
          <p>If you'd like to keep Pro features (custom colors, shuffle mode, weekly schedule), you don't need to do anything — it'll continue automatically.</p>
          <p>If you'd rather cancel, just go to Settings → Manage Plan before your trial ends. No hard feelings!</p>
          <p><a href="https://hiitem.com" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#ff3b30,#ff6b2b);color:#fff;text-decoration:none;border-radius:24px;font-weight:600;">Open HIITem</a></p>
          ${emailFooter}
        </div>`
      );

      await db.doc(`userProfiles/${uid}`).set(
        { trialReminderSent: true },
        { merge: true }
      );
      console.log(`Trial reminder sent to ${email}`);
    }
  }
);

// ── Send Test Email (admin only) ──
exports.sendTestEmail = onRequest(
  { secrets: [gmailAppPassword] },
  async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

    const { email, type } = req.body;
    if (!email) { res.status(400).json({ error: "Missing email" }); return; }

    const transporter = createTransporter(gmailAppPassword.value());
    const name = "Jaron";

    const templates = {
      welcome: {
        subject: "Welcome to HIITem!",
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;color:#222;">
          <h1 style="color:#ff6b2b;font-size:24px;">Welcome to HIITem, ${name}!</h1>
          <p>You're all set up and ready to go. Here's what you can do:</p>
          <ul style="padding-left:20px;line-height:1.8;">
            <li>Run timed HIIT workouts with 1-minute intervals</li>
            <li>Create and customize your own workouts</li>
            <li>Track your activity with heatmaps and stats</li>
            <li>Follow friends and share workouts</li>
          </ul>
          <p><a href="https://hiitem.com" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#ff3b30,#ff6b2b);color:#fff;text-decoration:none;border-radius:24px;font-weight:600;">Start a Workout</a></p>
          ${emailFooter}
        </div>`,
      },
      pro_confirmed: {
        subject: "Your Pro trial has started!",
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;color:#222;">
          <h1 style="color:#ff6b2b;font-size:24px;">Welcome to Pro, ${name}!</h1>
          <p>Your 7-day free trial is now active. Here's what you've unlocked:</p>
          <ul style="padding-left:20px;line-height:1.8;">
            <li>Custom timer colors</li>
            <li>Shuffle exercises mode</li>
            <li>Weekly workout schedule</li>
          </ul>
          <p>Your trial runs for 7 days. After that it's just $4.99/month — cancel anytime from Settings → Manage Plan.</p>
          <p><a href="https://hiitem.com" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#ff3b30,#ff6b2b);color:#fff;text-decoration:none;border-radius:24px;font-weight:600;">Open HIITem</a></p>
          ${emailFooter}
        </div>`,
      },
      trial_ending: {
        subject: "Your HIITem Pro trial ends in 2 days",
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;color:#222;">
          <h1 style="color:#ff6b2b;font-size:24px;">Heads up, ${name}!</h1>
          <p>Your 7-day Pro trial ends in 2 days. After that, your card will be charged $4.99/month.</p>
          <p>If you'd like to keep Pro features (custom colors, shuffle mode, weekly schedule), you don't need to do anything — it'll continue automatically.</p>
          <p>If you'd rather cancel, just go to Settings → Manage Plan before your trial ends. No hard feelings!</p>
          <p><a href="https://hiitem.com" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#ff3b30,#ff6b2b);color:#fff;text-decoration:none;border-radius:24px;font-weight:600;">Open HIITem</a></p>
          ${emailFooter}
        </div>`,
      },
      payment_failed: {
        subject: "Payment issue with your HIITem Pro plan",
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;color:#222;">
          <h1 style="color:#ff3b30;font-size:24px;">Payment failed</h1>
          <p>Hey ${name}, we had trouble charging your card for HIITem Pro ($4.99/month).</p>
          <p>Please update your payment method so you don't lose access to Pro features:</p>
          <p><a href="https://hiitem.com" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#ff3b30,#ff6b2b);color:#fff;text-decoration:none;border-radius:24px;font-weight:600;">Update Payment</a></p>
          <p style="font-size:13px;color:#666;">Go to Settings → Manage Plan to update your card.</p>
          ${emailFooter}
        </div>`,
      },
    };

    try {
      if (type === "all") {
        for (const [key, tmpl] of Object.entries(templates)) {
          await sendEmail(transporter, email, `[TEST] ${tmpl.subject}`, tmpl.html);
        }
        res.json({ sent: Object.keys(templates).length });
      } else {
        const tmpl = templates[type];
        if (!tmpl) { res.status(400).json({ error: `Unknown type: ${type}` }); return; }
        await sendEmail(transporter, email, `[TEST] ${tmpl.subject}`, tmpl.html);
        res.json({ sent: 1 });
      }
    } catch (err) {
      console.error("Test email error:", err);
      res.status(500).json({ error: err.message });
    }
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
