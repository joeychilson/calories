import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

import { isHostedMode } from '$lib/server/access';
import { db } from '$lib/server/db';
import { profiles } from '$lib/server/schema';
import { stripe } from '@better-auth/stripe';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import Stripe from 'stripe';

const stripeClient = isHostedMode() ? new Stripe(privateEnv.STRIPE_SECRET_KEY!) : null;

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
		deleteUser: { enabled: true },
		additionalFields: {
			onboardingCompleted: {
				type: 'boolean',
				required: true,
				defaultValue: false
			}
		}
	},
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					await db.insert(profiles).values({
						userId: user.id
					});
				}
			}
		}
	},
	plugins: isHostedMode()
		? [
				stripe({
					stripeClient: stripeClient!,
					stripeWebhookSecret: privateEnv.STRIPE_WEBHOOK_SECRET!,
					createCustomerOnSignUp: true,
					subscription: {
						enabled: true,
						plans: [
							{
								name: 'pro',
								priceId: privateEnv.STRIPE_PRICE_ID!,
								freeTrial: {
									days: 7
								}
							}
						]
					}
				})
			]
		: []
});
