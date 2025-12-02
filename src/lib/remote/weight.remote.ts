import { command, getRequestEvent, query } from '$app/server';
import { db } from '$lib/server/db';
import { weightLogs } from '$lib/server/schema';
import { error } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

export const logWeight = command(
	z.object({
		weight: z.number().positive(),
		date: z.string().optional()
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const date = input.date ? new Date(input.date) : new Date();

		const [log] = await db
			.insert(weightLogs)
			.values({
				userId: locals.user.id,
				weight: input.weight,
				date
			})
			.returning();

		return {
			id: log.id,
			weight: log.weight,
			date: log.date.toISOString().split('T')[0],
			timestamp: log.date.getTime()
		};
	}
);

export const getWeightLogs = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const logs = await db
		.select()
		.from(weightLogs)
		.where(eq(weightLogs.userId, locals.user.id))
		.orderBy(desc(weightLogs.date))
		.limit(30);

	return logs.map((l) => ({
		id: l.id,
		weight: l.weight,
		date: l.date.toISOString().split('T')[0],
		timestamp: l.date.getTime()
	}));
});

export const getLatestWeight = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const [latest] = await db
		.select()
		.from(weightLogs)
		.where(eq(weightLogs.userId, locals.user.id))
		.orderBy(desc(weightLogs.date))
		.limit(1);

	if (!latest) return null;

	return {
		weight: latest.weight,
		date: latest.date.toISOString().split('T')[0]
	};
});
