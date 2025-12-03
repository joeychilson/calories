import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { subscriptions } from '$lib/server/schema';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
		throw json({ error: 'Stripe not configured' }, { status: 500 });
	}

	const stripe = new Stripe(env.STRIPE_SECRET_KEY);
	const signature = request.headers.get('stripe-signature');

	if (!signature) {
		throw json({ error: 'Missing stripe-signature header' }, { status: 400 });
	}

	const body = await request.text();

	let event: Stripe.Event;
	try {
		event = await stripe.webhooks.constructEventAsync(body, signature, env.STRIPE_WEBHOOK_SECRET);
	} catch (err) {
		console.error('Webhook signature verification failed:', err);
		throw json({ error: 'Invalid signature' }, { status: 400 });
	}

	if (event.type === 'checkout.session.completed') {
		const session = event.data.object as Stripe.Checkout.Session;
		const userId = session.metadata?.userId;

		if (userId) {
			await db
				.update(subscriptions)
				.set({
					paid: true,
					paidAt: new Date(),
					updatedAt: new Date()
				})
				.where(eq(subscriptions.userId, userId));

			console.log(`Payment completed for user ${userId}`);
		}
	}

	return json({ received: true });
};
