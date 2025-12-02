import { command, getRequestEvent, query } from '$app/server';
import { analyzeMealFromImage, analyzeMealFromText } from '$lib/server/ai';
import { db } from '$lib/server/db';
import { mealLogs } from '$lib/server/schema';
import {
	deleteImage,
	getImageBuffer,
	getPresignedUploadUrl,
	getPresignedUrl,
	imageExists,
	s3Client
} from '$lib/server/storage';
import { error } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

const MIME_TO_EXT: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp'
};

const EXT_TO_MIME: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp'
};

export const getImageUploadUrl = command(z.object({ mimeType: z.string() }), async (input) => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const ext = MIME_TO_EXT[input.mimeType] || 'jpg';
	const timestamp = Date.now();
	const imageKey = `temp/${locals.user.id}/${timestamp}.${ext}`;
	const uploadUrl = getPresignedUploadUrl(imageKey);
	const downloadUrl = getPresignedUrl(imageKey, 86400);

	return { imageKey, uploadUrl, downloadUrl };
});

export const analyzeMealImage = command(
	z.object({
		imageKey: z.string(),
		mimeType: z.string().default('image/jpeg')
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		if (!input.imageKey.startsWith(`temp/${locals.user.id}/`)) {
			return error(403, 'Invalid image key');
		}

		try {
			const exists = await imageExists(input.imageKey);
			if (!exists) {
				return error(404, 'Image not found. Please try uploading again.');
			}

			const imageBuffer = await getImageBuffer(input.imageKey);
			const base64Data = imageBuffer.toString('base64');

			const analysis = await analyzeMealFromImage(base64Data, input.mimeType);
			if (!analysis.isFood) {
				await deleteImage(input.imageKey);
				return error(
					400,
					analysis.rejectionReason ||
						'This does not appear to be food. Please upload a photo of your meal.'
				);
			}

			return {
				name: analysis.name,
				calories: analysis.calories,
				protein: analysis.protein,
				carbs: analysis.carbs,
				fat: analysis.fat,
				imageKey: input.imageKey,
				isNutritionLabel: analysis.isNutritionLabel,
				servingSize: analysis.servingSize,
				servingQuantity: analysis.servingQuantity,
				servingUnit: analysis.servingUnit
			};
		} catch (err) {
			console.error('Meal analysis failed:', err);
			return error(500, 'Failed to analyze meal. Please try again.');
		}
	}
);

export const deleteUploadedImage = command(
	z.object({
		imageKey: z.string()
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		if (!input.imageKey.startsWith(`temp/${locals.user.id}/`)) {
			return error(403, 'Invalid image key');
		}

		try {
			await deleteImage(input.imageKey);
			return { success: true };
		} catch {
			return { success: true };
		}
	}
);

export const analyzeMealText = command(
	z.object({
		description: z.string().min(3)
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		try {
			const analysis = await analyzeMealFromText(input.description);
			if (!analysis.isFood) {
				return error(
					400,
					analysis.rejectionReason || 'This does not appear to be a valid food description.'
				);
			}

			return {
				name: analysis.name,
				calories: analysis.calories,
				protein: analysis.protein,
				carbs: analysis.carbs,
				fat: analysis.fat,
				isNutritionLabel: false
			};
		} catch (err) {
			console.error('Meal text analysis failed:', err);
			return error(500, 'Failed to analyze meal description. Please try again.');
		}
	}
);

export const addMeal = command(
	z.object({
		name: z.string().min(1),
		servings: z.number().positive().default(1),
		calories: z.number().int().positive(),
		protein: z.number().int().optional(),
		carbs: z.number().int().optional(),
		fat: z.number().int().optional(),
		imageKey: z.string().optional(),
		mealDate: z.string(),
		mealTime: z.string().optional()
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const mealTime = input.mealTime ? new Date(input.mealTime) : new Date();

		let permanentImageKey: string | undefined;

		if (input.imageKey?.startsWith(`temp/${locals.user.id}/`)) {
			const ext = input.imageKey.split('.').pop() || 'jpg';
			const mimeType = EXT_TO_MIME[ext] || 'image/jpeg';
			const timestamp = Date.now();
			permanentImageKey = `meals/${locals.user.id}/${timestamp}.${ext}`;

			const imageBuffer = await getImageBuffer(input.imageKey);
			await s3Client.write(permanentImageKey, imageBuffer, { type: mimeType });
			await deleteImage(input.imageKey);
		}

		const [meal] = await db
			.insert(mealLogs)
			.values({
				userId: locals.user.id,
				name: input.name,
				servings: input.servings,
				calories: input.calories,
				protein: input.protein,
				carbs: input.carbs,
				fat: input.fat,
				image: permanentImageKey,
				mealDate: input.mealDate,
				mealTime
			})
			.returning();

		return {
			id: meal.id,
			name: meal.name,
			servings: meal.servings,
			calories: meal.calories,
			protein: meal.protein,
			carbs: meal.carbs,
			fat: meal.fat,
			image: meal.image ? getPresignedUrl(meal.image) : null,
			date: meal.mealDate,
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
		servings: z.number().positive().default(1),
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
				servings: input.servings,
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
			servings: updatedMeal.servings,
			calories: updatedMeal.calories,
			protein: updatedMeal.protein,
			carbs: updatedMeal.carbs,
			fat: updatedMeal.fat,
			image: updatedMeal.image ? getPresignedUrl(updatedMeal.image) : null,
			date: updatedMeal.mealDate,
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
		servings: m.servings,
		calories: m.calories,
		protein: m.protein,
		carbs: m.carbs,
		fat: m.fat,
		image: m.image ? getPresignedUrl(m.image) : null,
		date: m.mealDate,
		timestamp: m.mealTime.getTime()
	}));
});
