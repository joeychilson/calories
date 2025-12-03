import { command, getRequestEvent, query } from '$app/server';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { isHostedMode } from '$lib/server/access';
import { db } from '$lib/server/db';
import { profiles, subscriptions } from '$lib/server/schema';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { z } from 'zod';

export const getSubscription = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const [subscription] = await db
		.select()
		.from(subscriptions)
		.where(eq(subscriptions.userId, locals.user.id));

	if (!subscription) {
		const [newSubscription] = await db
			.insert(subscriptions)
			.values({
				userId: locals.user.id,
				onboardingCompleted: false
			})
			.returning();

		const [existingProfile] = await db
			.select()
			.from(profiles)
			.where(eq(profiles.userId, locals.user.id));

		if (!existingProfile) {
			await db.insert(profiles).values({
				userId: locals.user.id
			});
		}

		return {
			onboardingCompleted: newSubscription.onboardingCompleted,
			paid: newSubscription.paid,
			required: isHostedMode()
		};
	}

	return {
		onboardingCompleted: subscription.onboardingCompleted,
		paid: subscription.paid,
		required: isHostedMode()
	};
});

export const markOnboardingComplete = command(z.void(), async () => {
	const { locals } = getRequestEvent();

	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const [updated] = await db
		.update(subscriptions)
		.set({
			onboardingCompleted: true,
			updatedAt: new Date()
		})
		.where(eq(subscriptions.userId, locals.user.id))
		.returning();

	if (!updated) {
		return error(404, 'Subscription not found');
	}

	return {
		onboardingCompleted: updated.onboardingCompleted
	};
});

export const createCheckoutSession = command(z.void(), async () => {
	const { locals } = getRequestEvent();

	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	if (!isHostedMode()) {
		return error(400, 'Payments not enabled in self-hosted mode');
	}

	if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) {
		return error(500, 'Stripe not configured');
	}

	const stripe = new Stripe(env.STRIPE_SECRET_KEY);

	const [subscription] = await db
		.select()
		.from(subscriptions)
		.where(eq(subscriptions.userId, locals.user.id));

	if (subscription?.paid) {
		return error(400, 'Already paid');
	}

	let customerId = subscription?.stripeCustomerId;
	if (!customerId) {
		const customer = await stripe.customers.create({
			email: locals.user.email,
			name: locals.user.name,
			metadata: {
				userId: locals.user.id
			}
		});
		customerId = customer.id;

		if (subscription) {
			await db
				.update(subscriptions)
				.set({ stripeCustomerId: customerId, updatedAt: new Date() })
				.where(eq(subscriptions.userId, locals.user.id));
		} else {
			await db.insert(subscriptions).values({
				userId: locals.user.id,
				stripeCustomerId: customerId
			});
		}
	}

	const session = await stripe.checkout.sessions.create({
		customer: customerId,
		mode: 'payment',
		line_items: [
			{
				price: env.STRIPE_PRICE_ID,
				quantity: 1
			}
		],
		success_url: `${publicEnv.PUBLIC_BASE_URL}/checkout/success`,
		cancel_url: `${publicEnv.PUBLIC_BASE_URL}/checkout`,
		metadata: {
			userId: locals.user.id
		}
	});

	return { url: session.url };
});
