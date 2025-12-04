import { isHostedMode } from '$lib/server/access';
import { auth } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent, url, request }) => {
	const { user, session } = await parent();
	if (!session || !user) {
		throw redirect(302, '/signin');
	}

	const isOnboarding = url.pathname.startsWith('/onboarding');

	if (!isOnboarding && !user.onboardingCompleted) {
		throw redirect(302, '/onboarding');
	}

	const skipSubscriptionCheck = url.pathname.startsWith('/checkout') || isOnboarding;

	if (skipSubscriptionCheck || !isHostedMode()) {
		return { trialEnd: null };
	}

	const subscriptions = await auth.api.listActiveSubscriptions({
		headers: request.headers
	});

	const activeSubscription = subscriptions?.find(
		(sub) => sub.status === 'active' || sub.status === 'trialing'
	);

	if (!activeSubscription) {
		throw redirect(302, '/checkout');
	}

	const trialEnd = activeSubscription.status === 'trialing' ? activeSubscription.trialEnd : null;

	return { trialEnd };
};
