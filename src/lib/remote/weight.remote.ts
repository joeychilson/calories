import { command, getRequestEvent, query } from '$app/server';
import { db } from '$lib/server/db';
import { weightLogs } from '$lib/server/schema';
import { formatDate, parseLocalDate } from '$lib/utils/format';
import { error } from '@sveltejs/kit';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { z } from 'zod';

export const logWeight = command(
	z.object({
		weight: z.number().positive(),
		date: z.string()
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const date = parseLocalDate(input.date);
		const nextDay = new Date(date);
		nextDay.setDate(nextDay.getDate() + 1);

		const [existing] = await db
			.select()
			.from(weightLogs)
			.where(
				and(
					eq(weightLogs.userId, locals.user.id),
					gte(weightLogs.date, date),
					lt(weightLogs.date, nextDay)
				)
			);

		let log;
		if (existing) {
			[log] = await db
				.update(weightLogs)
				.set({ weight: input.weight, updatedAt: new Date() })
				.where(eq(weightLogs.id, existing.id))
				.returning();
		} else {
			[log] = await db
				.insert(weightLogs)
				.values({
					userId: locals.user.id,
					weight: input.weight,
					date
				})
				.returning();
		}

		return {
			id: log.id,
			weight: log.weight,
			date: formatDate(log.date),
			timestamp: log.date.getTime(),
			updated: !!existing
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
		date: formatDate(l.date),
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
		date: formatDate(latest.date)
	};
});

export const getWeightForDate = query(z.string(), async (date) => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const startDate = parseLocalDate(date);
	const endDate = new Date(startDate);
	endDate.setDate(endDate.getDate() + 1);

	const [entry] = await db
		.select()
		.from(weightLogs)
		.where(
			and(
				eq(weightLogs.userId, locals.user.id),
				gte(weightLogs.date, startDate),
				lt(weightLogs.date, endDate)
			)
		);

	if (!entry) return null;

	return {
		weight: entry.weight,
		date: formatDate(entry.date)
	};
});
