import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { generateRequestId, logError, logRequest } from '$lib/server/logger';
import { type Handle, isHttpError, isRedirect, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const loggingHandler: Handle = async ({ event, resolve }) => {
	const requestId = generateRequestId();
	const start = Date.now();

	event.locals.requestId = requestId;

	try {
		const response = await resolve(event);
		const duration = Date.now() - start;

		logRequest({
			requestId,
			method: event.request.method,
			path: event.url.pathname,
			status: response.status,
			duration,
			userId: event.locals.user?.id
		});

		return response;
	} catch (error) {
		if (isRedirect(error) || isHttpError(error)) {
			throw error;
		}

		const duration = Date.now() - start;

		logError({
			requestId,
			method: event.request.method,
			path: event.url.pathname,
			userId: event.locals.user?.id,
			error
		});

		logRequest({
			requestId,
			method: event.request.method,
			path: event.url.pathname,
			status: 500,
			duration,
			userId: event.locals.user?.id
		});

		throw error;
	}
};

const authHandler: Handle = async ({ event, resolve }) => {
	return svelteKitHandler({ event, resolve, auth, building });
};

const authRedirect: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({
		headers: event.request.headers
	});

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;

		if (event.url.pathname === '/signin') {
			return redirect(303, '/');
		}
	} else if (event.url.pathname !== '/signin' && !event.url.pathname.startsWith('/api/')) {
		return redirect(303, '/signin');
	}

	return await resolve(event);
};

export const handle = sequence(loggingHandler, authHandler, authRedirect);
