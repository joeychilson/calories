import { command, getRequestEvent, query } from '$app/server';
import { optimizeCaloriesWithAI } from '$lib/server/ai';
import { db } from '$lib/server/db';
import { settings, weightLogs } from '$lib/server/schema';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const getSettings = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const [userSettings] = await db
		.select()
		.from(settings)
		.where(eq(settings.userId, locals.user.id));

	if (!userSettings) {
		const [newSettings] = await db
			.insert(settings)
			.values({
				userId: locals.user.id,
				calorieGoal: 2200,
				weightGoal: null,
				weightUnit: 'lbs',
				onboardingCompleted: false
			})
			.returning();

		return {
			calorieGoal: newSettings.calorieGoal,
			weightGoal: newSettings.weightGoal,
			weightUnit: newSettings.weightUnit,
			onboardingCompleted: newSettings.onboardingCompleted
		};
	}

	return {
		calorieGoal: userSettings.calorieGoal,
		weightGoal: userSettings.weightGoal,
		weightUnit: userSettings.weightUnit,
		onboardingCompleted: userSettings.onboardingCompleted
	};
});

export const updateSettings = command(
	z.object({
		calorieGoal: z.number().int().positive().optional(),
		weightGoal: z.number().positive().optional(),
		weightUnit: z.enum(['lbs', 'kg']).optional(),
		onboardingCompleted: z.boolean().optional()
	}),
	async (input) => {
		const { locals } = getRequestEvent();

		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const [updated] = await db
			.update(settings)
			.set({
				...(input.calorieGoal !== undefined && { calorieGoal: input.calorieGoal }),
				...(input.weightGoal !== undefined && { weightGoal: input.weightGoal }),
				...(input.weightUnit !== undefined && { weightUnit: input.weightUnit }),
				...(input.onboardingCompleted !== undefined && {
					onboardingCompleted: input.onboardingCompleted
				}),
				updatedAt: new Date()
			})
			.where(eq(settings.userId, locals.user.id))
			.returning();

		if (!updated) {
			return error(404, 'Settings not found');
		}

		return {
			calorieGoal: updated.calorieGoal,
			weightGoal: updated.weightGoal,
			weightUnit: updated.weightUnit,
			onboardingCompleted: updated.onboardingCompleted
		};
	}
);

export const completeOnboarding = command(
	z.object({
		calorieGoal: z.number().int().positive(),
		weightGoal: z.number().positive().optional(),
		weightUnit: z.enum(['lbs', 'kg']),
		currentWeight: z.number().positive().optional()
	}),
	async (input) => {
		const { locals } = getRequestEvent();

		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const [updated] = await db
			.update(settings)
			.set({
				calorieGoal: input.calorieGoal,
				weightGoal: input.weightGoal ?? null,
				weightUnit: input.weightUnit,
				onboardingCompleted: true,
				updatedAt: new Date()
			})
			.where(eq(settings.userId, locals.user.id))
			.returning();

		if (!updated) {
			return error(404, 'Settings not found');
		}

		if (input.currentWeight) {
			await db.insert(weightLogs).values({
				userId: locals.user.id,
				weight: input.currentWeight,
				date: new Date()
			});
		}

		return {
			calorieGoal: updated.calorieGoal,
			weightGoal: updated.weightGoal,
			weightUnit: updated.weightUnit,
			onboardingCompleted: updated.onboardingCompleted
		};
	}
);

export const optimizeCalories = command(
	z.object({
		currentWeight: z.number().positive(),
		goalWeight: z.number().positive(),
		unit: z.string()
	}),
	async (input) => {
		const { locals } = getRequestEvent();

		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const result = await optimizeCaloriesWithAI(input.currentWeight, input.goalWeight, input.unit);

		return result;
	}
);
