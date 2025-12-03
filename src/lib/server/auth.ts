import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

import { isHostedMode } from '$lib/server/access';
import { db } from '$lib/server/db';
import { subscriptions } from '$lib/server/schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import Stripe from 'stripe';

export const auth = betterAuth({
	baseURL: publicEnv.PUBLIC_BASE_URL,
	secret: privateEnv.AUTH_SECRET,
	database: drizzleAdapter(db, {
		provider: 'pg',
		usePlural: true
	}),
	socialProviders: {
		google: {
			clientId: privateEnv.GOOGLE_CLIENT_ID as string,
			clientSecret: privateEnv.GOOGLE_CLIENT_SECRET as string
		}
	},
	advanced: {
		database: { generateId: false }
	},
	user: {
		deleteUser: { enabled: true }
	},
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					if (!isHostedMode() || !privateEnv.STRIPE_SECRET_KEY) {
						return;
					}

					const stripe = new Stripe(privateEnv.STRIPE_SECRET_KEY);

					const customers = await stripe.customers.list({
						email: user.email,
						limit: 1
					});

					if (customers.data.length === 0) {
						return;
					}

					const customer = customers.data[0];

					const payments = await stripe.paymentIntents.list({
						customer: customer.id,
						limit: 10
					});

					const hasPaid = payments.data.some((p) => p.status === 'succeeded');

					if (hasPaid) {
						await db.insert(subscriptions).values({
							userId: user.id,
							paid: true,
							paidAt: new Date(),
							stripeCustomerId: customer.id
						});
					}
				}
			}
		}
	}
});
