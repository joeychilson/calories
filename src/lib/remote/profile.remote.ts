import { command, getRequestEvent, query } from '$app/server';
import { db } from '$lib/server/db';
import { profiles, weightLogs } from '$lib/server/schema';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const getProfile = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const [profile] = await db.select().from(profiles).where(eq(profiles.userId, locals.user.id));

	if (!profile) {
		const [newProfile] = await db
			.insert(profiles)
			.values({
				userId: locals.user.id
			})
			.returning();

		return {
			units: newProfile.units as 'imperial' | 'metric',
			height: newProfile.height,
			weightGoal: newProfile.weightGoal,
			calorieGoal: newProfile.calorieGoal,
			waterGoal: newProfile.waterGoal,
			birthDate: newProfile.birthDate?.toISOString() ?? null,
			sex: newProfile.sex as 'male' | 'female' | null,
			activityLevel: newProfile.activityLevel as
				| 'sedentary'
				| 'light'
				| 'moderate'
				| 'active'
				| 'very_active'
		};
	}

	return {
		units: profile.units as 'imperial' | 'metric',
		height: profile.height,
		weightGoal: profile.weightGoal,
		calorieGoal: profile.calorieGoal,
		waterGoal: profile.waterGoal,
		birthDate: profile.birthDate?.toISOString() ?? null,
		sex: profile.sex as 'male' | 'female' | null,
		activityLevel: profile.activityLevel as
			| 'sedentary'
			| 'light'
			| 'moderate'
			| 'active'
			| 'very_active'
	};
});

export const updateProfile = command(
	z.object({
		units: z.enum(['imperial', 'metric']).optional(),
		height: z.number().positive().optional(),
		weightGoal: z.number().positive().optional(),
		calorieGoal: z.number().int().positive().optional(),
		waterGoal: z.number().int().positive().optional(),
		birthDate: z.string().optional(),
		sex: z.enum(['male', 'female']).optional(),
		activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional()
	}),
	async (input) => {
		const { locals } = getRequestEvent();

		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const [updated] = await db
			.update(profiles)
			.set({
				...(input.units !== undefined && { units: input.units }),
				...(input.height !== undefined && { height: input.height }),
				...(input.weightGoal !== undefined && { weightGoal: input.weightGoal }),
				...(input.calorieGoal !== undefined && { calorieGoal: input.calorieGoal }),
				...(input.waterGoal !== undefined && { waterGoal: input.waterGoal }),
				...(input.birthDate !== undefined && { birthDate: new Date(input.birthDate) }),
				...(input.sex !== undefined && { sex: input.sex }),
				...(input.activityLevel !== undefined && { activityLevel: input.activityLevel }),
				updatedAt: new Date()
			})
			.where(eq(profiles.userId, locals.user.id))
			.returning();

		if (!updated) {
			return error(404, 'Profile not found');
		}

		return {
			units: updated.units as 'imperial' | 'metric',
			height: updated.height,
			weightGoal: updated.weightGoal,
			calorieGoal: updated.calorieGoal,
			waterGoal: updated.waterGoal,
			birthDate: updated.birthDate?.toISOString() ?? null,
			sex: updated.sex as 'male' | 'female' | null,
			activityLevel: updated.activityLevel as
				| 'sedentary'
				| 'light'
				| 'moderate'
				| 'active'
				| 'very_active'
		};
	}
);

export const completeOnboarding = command(
	z.object({
		units: z.enum(['imperial', 'metric']),
		height: z.number().positive(),
		weightGoal: z.number().positive().optional(),
		calorieGoal: z.number().int().positive(),
		waterGoal: z.number().int().positive(),
		birthDate: z.string().optional(),
		sex: z.enum(['male', 'female']).optional(),
		activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
		currentWeight: z.number().positive().optional()
	}),
	async (input) => {
		const { locals } = getRequestEvent();

		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const [updated] = await db
			.update(profiles)
			.set({
				units: input.units,
				height: input.height,
				weightGoal: input.weightGoal ?? null,
				calorieGoal: input.calorieGoal,
				waterGoal: input.waterGoal,
				birthDate: input.birthDate ? new Date(input.birthDate) : null,
				sex: input.sex ?? null,
				activityLevel: input.activityLevel,
				updatedAt: new Date()
			})
			.where(eq(profiles.userId, locals.user.id))
			.returning();

		if (!updated) {
			return error(404, 'Profile not found');
		}

		if (input.currentWeight) {
			await db.insert(weightLogs).values({
				userId: locals.user.id,
				weight: input.currentWeight,
				date: new Date()
			});
		}

		return {
			units: updated.units as 'imperial' | 'metric',
			height: updated.height,
			weightGoal: updated.weightGoal,
			calorieGoal: updated.calorieGoal,
			waterGoal: updated.waterGoal,
			birthDate: updated.birthDate?.toISOString() ?? null,
			sex: updated.sex as 'male' | 'female' | null,
			activityLevel: updated.activityLevel as
				| 'sedentary'
				| 'light'
				| 'moderate'
				| 'active'
				| 'very_active'
		};
	}
);
