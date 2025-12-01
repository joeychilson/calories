import { command, getRequestEvent, query } from '$app/server';
import { analyzeMealFromImage } from '$lib/server/ai';
import { db } from '$lib/server/db';
import { mealLogs } from '$lib/server/schema';
import { getPresignedUrl, s3Client } from '$lib/server/storage';
import { error } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

export const analyzeMealImage = command(
	z.object({
		imageData: z.string(),
		mimeType: z.string(),
		fileName: z.string()
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
		if (!allowedTypes.includes(input.mimeType)) {
			return error(400, 'Invalid image type. Please upload a JPEG, PNG, or WebP image.');
		}

		try {
			const base64Data = input.imageData.replace(/^data:image\/\w+;base64,/, '');

			const analysis = await analyzeMealFromImage(base64Data, input.mimeType);
			if (!analysis.isFood) {
				return error(
					400,
					analysis.rejectionReason ||
						'This does not appear to be food. Please upload a photo of your meal.'
				);
			}

			const timestamp = Date.now();
			const ext = input.fileName.split('.').pop() || 'jpg';
			const imageKey = `meals/${locals.user.id}/${timestamp}.${ext}`;

			const buffer = Buffer.from(base64Data, 'base64');
			await s3Client.write(imageKey, buffer, {
				type: input.mimeType
			});

			return {
				name: analysis.name,
				calories: analysis.calories,
				protein: analysis.protein,
				carbs: analysis.carbs,
				fat: analysis.fat,
				sodium: analysis.sodium,
				cholesterol: analysis.cholesterol,
				fiber: analysis.fiber,
				sugar: analysis.sugar,
				imageKey
			};
		} catch (err) {
			console.error('Meal analysis failed:', err);
			return error(500, 'Failed to analyze meal. Please try again.');
		}
	}
);

export const addMeal = command(
	z.object({
		name: z.string().min(1),
		calories: z.number().int().positive(),
		protein: z.number().int().optional(),
		carbs: z.number().int().optional(),
		fat: z.number().int().optional(),
		sodium: z.number().int().optional(),
		cholesterol: z.number().int().optional(),
		fiber: z.number().int().optional(),
		sugar: z.number().int().optional(),
		imageKey: z.string().optional(),
		mealTime: z.string().optional()
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const mealTime = input.mealTime ? new Date(input.mealTime) : new Date();

		const [meal] = await db
			.insert(mealLogs)
			.values({
				userId: locals.user.id,
				name: input.name,
				calories: input.calories,
				protein: input.protein,
				carbs: input.carbs,
				fat: input.fat,
				sodium: input.sodium,
				cholesterol: input.cholesterol,
				fiber: input.fiber,
				sugar: input.sugar,
				image: input.imageKey,
				mealTime
			})
			.returning();

		return {
			id: meal.id,
			name: meal.name,
			calories: meal.calories,
			protein: meal.protein,
			carbs: meal.carbs,
			fat: meal.fat,
			image: meal.image ? getPresignedUrl(meal.image) : null,
			date: meal.mealTime.toISOString().split('T')[0],
			timestamp: meal.mealTime.getTime()
		};
	}
);

export const deleteMeal = command(z.string().uuid(), async (id) => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const [meal] = await db
		.select()
		.from(mealLogs)
		.where(and(eq(mealLogs.id, id), eq(mealLogs.userId, locals.user.id)));

	if (!meal) {
		return error(404, 'Meal not found');
	}

	if (meal.image) {
		await s3Client.delete(meal.image);
	}

	await db.delete(mealLogs).where(eq(mealLogs.id, id));

	return { success: true };
});

export const updateMeal = command(
	z.object({
		id: z.uuid(),
		name: z.string().min(1),
		calories: z.number().int().positive(),
		protein: z.number().int().optional(),
		carbs: z.number().int().optional(),
		fat: z.number().int().optional()
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const [updatedMeal] = await db
			.update(mealLogs)
			.set({
				name: input.name,
				calories: input.calories,
				protein: input.protein,
				carbs: input.carbs,
				fat: input.fat
			})
			.where(and(eq(mealLogs.id, input.id), eq(mealLogs.userId, locals.user.id)))
			.returning();

		if (!updatedMeal) {
			return error(404, 'Meal not found');
		}

		return {
			id: updatedMeal.id,
			name: updatedMeal.name,
			calories: updatedMeal.calories,
			protein: updatedMeal.protein,
			carbs: updatedMeal.carbs,
			fat: updatedMeal.fat,
			image: updatedMeal.image ? getPresignedUrl(updatedMeal.image) : null,
			date: updatedMeal.mealTime.toISOString().split('T')[0],
			timestamp: updatedMeal.mealTime.getTime()
		};
	}
);

export const getMeals = query(async () => {
	const { locals } = getRequestEvent();

	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const meals = await db
		.select()
		.from(mealLogs)
		.where(eq(mealLogs.userId, locals.user.id))
		.orderBy(desc(mealLogs.mealTime));

	return meals.map((m) => ({
		id: m.id,
		name: m.name,
		calories: m.calories,
		protein: m.protein,
		carbs: m.carbs,
		fat: m.fat,
		image: m.image ? getPresignedUrl(m.image) : null,
		date: m.mealTime.toISOString().split('T')[0],
		timestamp: m.mealTime.getTime()
	}));
});
