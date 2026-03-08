import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { authenticate, AuthRequest } from '../middleware/auth';
import { query } from '../db/pool';

/**
 * Subscriptions API
 *
 * HOW STRIPE INTEGRATION WORKS:
 * 1. User clicks "Upgrade" on the pricing page
 * 2. Backend creates a Stripe Checkout Session (a secure payment page hosted by Stripe)
 * 3. User is redirected to Stripe's hosted page to enter payment details
 * 4. After payment, Stripe sends a webhook to our server confirming the payment
 * 5. Our webhook handler updates the user's subscription tier in the database
 *
 * This approach means we NEVER handle credit card data directly — Stripe does it all.
 *
 * SETUP REQUIRED:
 * 1. Create a Stripe account at https://stripe.com
 * 2. Get your API keys from the Stripe Dashboard
 * 3. Create two Products in Stripe with Prices (Premium monthly/yearly, Ultimate monthly/yearly)
 * 4. Set the price IDs in your .env file
 * 5. Set up the webhook endpoint in Stripe Dashboard pointing to /api/subscriptions/webhook
 */

const router = Router();

// Initialize Stripe (only if key is set)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Price IDs from Stripe Dashboard — set these in .env after creating Products in Stripe
const PRICE_IDS: Record<string, Record<string, string>> = {
  premium: {
    monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || '',
    yearly: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID || '',
  },
  ultimate: {
    monthly: process.env.STRIPE_ULTIMATE_MONTHLY_PRICE_ID || '',
    yearly: process.env.STRIPE_ULTIMATE_YEARLY_PRICE_ID || '',
  },
};

/**
 * GET /api/subscriptions/status
 * Get current user's subscription details
 */
router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT subscription, subscription_expires_at,
              (SELECT COUNT(*) FROM characters WHERE creator_id = $1) as character_count,
              (SELECT COUNT(*) FROM worlds WHERE creator_id = $1) as world_count
       FROM users WHERE id = $1`,
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const user = result.rows[0];
    const limits: Record<string, { characters: number; worlds: number; dailyChats: number }> = {
      free: { characters: 3, worlds: 0, dailyChats: 10 },
      premium: { characters: 10, worlds: 1, dailyChats: Infinity },
      ultimate: { characters: Infinity, worlds: Infinity, dailyChats: Infinity },
    };

    const tier = user.subscription || 'free';
    const tierLimits = limits[tier] || limits.free;

    res.json({
      success: true,
      data: {
        tier,
        expiresAt: user.subscription_expires_at,
        usage: {
          characters: parseInt(user.character_count),
          worlds: parseInt(user.world_count),
        },
        limits: tierLimits,
      },
    });
  } catch (err) {
    console.error('Subscription status error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch subscription status' });
  }
});

/**
 * POST /api/subscriptions/checkout
 * Create a Stripe Checkout Session for upgrading
 */
router.post('/checkout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { plan, cycle = 'monthly' } = req.body;

    // Validate plan
    if (!['premium', 'ultimate'].includes(plan)) {
      res.status(400).json({ success: false, message: 'Invalid plan. Choose premium or ultimate.' });
      return;
    }

    // Check if Stripe is configured
    if (!stripe) {
      res.status(500).json({
        success: false,
        message: 'Payment system is not configured yet. Please check back later!',
      });
      return;
    }

    const priceId = PRICE_IDS[plan]?.[cycle];
    if (!priceId) {
      res.status(400).json({
        success: false,
        message: 'Price configuration missing. Please contact support.',
      });
      return;
    }

    // Check if user already has a Stripe customer ID
    const userResult = await query(
      'SELECT stripe_customer_id, email FROM users WHERE id = $1',
      [req.user!.id]
    );
    const userData = userResult.rows[0];

    let customerId = userData.stripe_customer_id;

    // Create Stripe customer if none exists
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.email,
        metadata: {
          userId: req.user!.id,
          username: req.user!.username,
        },
      });
      customerId = customer.id;

      // Save customer ID to database
      await query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, req.user!.id]
      );
    }

    // Create checkout session
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/subscription?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/pricing?status=cancelled`,
      metadata: {
        userId: req.user!.id,
        plan,
        cycle,
      },
    });

    res.json({ success: true, data: { url: session.url } });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ success: false, message: 'Failed to create checkout session' });
  }
});

/**
 * POST /api/subscriptions/portal
 * Create a Stripe Customer Portal session for managing subscription
 * (change plan, update payment method, cancel, view invoices)
 */
router.post('/portal', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!stripe) {
      res.status(500).json({ success: false, message: 'Payment system not configured' });
      return;
    }

    const userResult = await query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [req.user!.id]
    );

    const customerId = userResult.rows[0]?.stripe_customer_id;
    if (!customerId) {
      res.status(400).json({ success: false, message: 'No active subscription found' });
      return;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${frontendUrl}/subscription`,
    });

    res.json({ success: true, data: { url: session.url } });
  } catch (err) {
    console.error('Portal error:', err);
    res.status(500).json({ success: false, message: 'Failed to open billing portal' });
  }
});

/**
 * POST /api/subscriptions/webhook
 * Handle Stripe webhook events (payment confirmations, cancellations, etc.)
 *
 * IMPORTANT: This endpoint must receive the RAW body (not JSON-parsed)
 * for Stripe signature verification to work.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  if (!stripe) {
    res.status(500).json({ success: false, message: 'Stripe not configured' });
    return;
  }

  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    res.status(500).json({ success: false, message: 'Webhook not configured' });
    return;
  }

  let event: Stripe.Event;

  try {
    // Verify the webhook signature using the raw body
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).json({ success: false, message: 'Webhook signature verification failed' });
    return;
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;

        if (userId && plan) {
          await query(
            `UPDATE users SET subscription = $1, subscription_expires_at = NULL, updated_at = NOW() WHERE id = $2`,
            [plan, userId]
          );
          console.log(`[Stripe] User ${userId} upgraded to ${plan}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by stripe_customer_id
        const userResult = await query(
          'SELECT id FROM users WHERE stripe_customer_id = $1',
          [customerId]
        );

        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].id;

          if (subscription.status === 'active') {
            // Determine plan from price
            const priceId = subscription.items.data[0]?.price?.id;
            let plan = 'premium'; // default

            if (priceId === PRICE_IDS.ultimate.monthly || priceId === PRICE_IDS.ultimate.yearly) {
              plan = 'ultimate';
            }

            const expiresAt = new Date((subscription as any).current_period_end * 1000);
            await query(
              `UPDATE users SET subscription = $1, subscription_expires_at = $2, updated_at = NOW() WHERE id = $3`,
              [plan, expiresAt, userId]
            );
            console.log(`[Stripe] User ${userId} subscription updated to ${plan}`);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const userResult = await query(
          'SELECT id FROM users WHERE stripe_customer_id = $1',
          [customerId]
        );

        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].id;
          await query(
            `UPDATE users SET subscription = 'free', subscription_expires_at = NULL, updated_at = NOW() WHERE id = $1`,
            [userId]
          );
          console.log(`[Stripe] User ${userId} subscription cancelled, downgraded to free`);
        }
        break;
      }

      default:
        // Unhandled event type — that's OK, we just log it
        console.log(`[Stripe] Unhandled event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ success: false, message: 'Webhook handler failed' });
  }
});

/**
 * GET /api/subscriptions/chat-usage
 * Check how many chats the user has sent today (for free tier daily limit)
 */
router.get('/chat-usage', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const tier = req.user!.subscription;

    // Premium and Ultimate have unlimited chats
    if (tier === 'premium' || tier === 'ultimate') {
      res.json({
        success: true,
        data: { used: 0, limit: null, remaining: null, unlimited: true },
      });
      return;
    }

    // Count messages sent today by this user
    const result = await query(
      `SELECT COUNT(*) FROM messages
       WHERE sender_user_id = $1
       AND created_at >= CURRENT_DATE
       AND sender_type = 'user'`,
      [req.user!.id]
    );

    const used = parseInt(result.rows[0].count);
    const limit = 10;
    const remaining = Math.max(0, limit - used);

    res.json({
      success: true,
      data: { used, limit, remaining, unlimited: false },
    });
  } catch (err) {
    console.error('Chat usage error:', err);
    res.status(500).json({ success: false, message: 'Failed to check chat usage' });
  }
});

export { router as subscriptionRouter };
