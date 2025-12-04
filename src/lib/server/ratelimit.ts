import type { RequestEvent } from '@sveltejs/kit';
import { RateLimiter, type Rate, type RateLimiterPlugin } from 'sveltekit-rate-limiter/server';

class UserIdLimiter implements RateLimiterPlugin {
	readonly rate: Rate;

	constructor(rate: Rate) {
		this.rate = rate;
	}

	async hash(event: RequestEvent) {
		const userId = event.locals.user?.id;
		return userId ?? false;
	}
}

export const aiLimiter = new RateLimiter({
	plugins: [new UserIdLimiter([20, 'm'])]
});
