import { building } from '$app/environment';
import { hasAccess, isHostedMode } from '$lib/server/access';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { subscriptions } from '$lib/server/schema';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { eq } from 'drizzle-orm';

const authHandler: Handle = async ({ event, resolve }) => {
	return svelteKitHandler({ event, resolve, auth, building });
};

const authRedirect: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	const publicRoutes = ['/signin', '/checkout', '/checkout/success'];
	const isPublicRoute = publicRoutes.some((route) => pathname === route);
	const isWebhook = pathname.startsWith('/api/webhook');

	const session = await auth.api.getSession({
		headers: event.request.headers
	});

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;

		if (pathname === '/signin') {
			return redirect(303, '/');
		}

		if (isHostedMode() && !isPublicRoute && !isWebhook) {
			const [userSubscription] = await db
				.select()
				.from(subscriptions)
				.where(eq(subscriptions.userId, session.user.id));

			if (!hasAccess(userSubscription?.paid ?? false)) {
				return redirect(303, '/checkout');
			}
		}
	} else if (!isPublicRoute && !isWebhook) {
		return redirect(303, '/signin');
	}

	return await resolve(event);
};

export const handle = sequence(authHandler, authRedirect);
