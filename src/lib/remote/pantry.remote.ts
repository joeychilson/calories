import { command, getRequestEvent, query } from '$app/server';
import { MIME_TO_EXT } from '$lib/constants/mime';
import { analyzePantryImage } from '$lib/server/ai';
import { db } from '$lib/server/db';
import { pantryCategoryValues, pantryItems } from '$lib/server/schema';
import {
	deleteImage,
	getImageBuffer,
	getPresignedUploadUrl,
	imageExists
} from '$lib/server/storage';
import { error } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

export const getPantryImageUploadUrl = command(
	z.object({ mimeType: z.string() }),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const ext = MIME_TO_EXT[input.mimeType] || 'jpg';
		const timestamp = Date.now();
		const imageKey = `temp/${locals.user.id}/pantry-${timestamp}.${ext}`;
		const uploadUrl = getPresignedUploadUrl(imageKey);

		return { imageKey, uploadUrl };
	}
);

export const scanPantryImage = command(
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

			const analysis = await analyzePantryImage(base64Data, input.mimeType);

			await deleteImage(input.imageKey);

			if (analysis.imageType === 'invalid') {
				return error(
					400,
					analysis.rejectionReason || 'Could not identify food items in this image.'
				);
			}

			return {
				imageType: analysis.imageType,
				storeName: analysis.storeName,
				items: analysis.items
			};
		} catch (err) {
			console.error('Pantry image analysis failed:', err);
			return error(500, 'Failed to analyze image. Please try again.');
		}
	}
);

export const addPantryItem = command(
	z.object({
		name: z.string().min(1),
		category: z.enum(pantryCategoryValues).optional(),
		quantity: z.number().positive().optional(),
		unit: z.string().optional()
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const [item] = await db
			.insert(pantryItems)
			.values({
				userId: locals.user.id,
				name: input.name,
				category: input.category,
				quantity: input.quantity,
				unit: input.unit
			})
			.returning();

		return {
			id: item.id,
			name: item.name,
			category: item.category,
			quantity: item.quantity,
			unit: item.unit
		};
	}
);

export const addPantryItems = command(
	z.array(
		z.object({
			name: z.string().min(1),
			category: z.enum(pantryCategoryValues).optional(),
			quantity: z.number().positive().optional(),
			unit: z.string().optional()
		})
	),
	async (items) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		if (items.length === 0) {
			return { added: [] };
		}

		const insertedItems = await db
			.insert(pantryItems)
			.values(
				items.map((item) => ({
					userId: locals.user!.id,
					name: item.name,
					category: item.category,
					quantity: item.quantity,
					unit: item.unit
				}))
			)
			.returning();

		return {
			added: insertedItems.map((item) => ({
				id: item.id,
				name: item.name,
				category: item.category,
				quantity: item.quantity,
				unit: item.unit
			}))
		};
	}
);

export const updatePantryItem = command(
	z.object({
		id: z.string().uuid(),
		name: z.string().min(1).optional(),
		category: z.enum(pantryCategoryValues).optional(),
		quantity: z.number().positive().optional(),
		unit: z.string().optional()
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const updateData: Record<string, unknown> = { updatedAt: new Date() };

		if (input.name !== undefined) updateData.name = input.name;
		if (input.category !== undefined) updateData.category = input.category;
		if (input.quantity !== undefined) updateData.quantity = input.quantity;
		if (input.unit !== undefined) updateData.unit = input.unit;

		const [updatedItem] = await db
			.update(pantryItems)
			.set(updateData)
			.where(and(eq(pantryItems.id, input.id), eq(pantryItems.userId, locals.user.id)))
			.returning();

		if (!updatedItem) {
			return error(404, 'Item not found');
		}

		return {
			id: updatedItem.id,
			name: updatedItem.name,
			category: updatedItem.category,
			quantity: updatedItem.quantity,
			unit: updatedItem.unit
		};
	}
);

export const deletePantryItem = command(z.string().uuid(), async (id) => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const [deleted] = await db
		.delete(pantryItems)
		.where(and(eq(pantryItems.id, id), eq(pantryItems.userId, locals.user.id)))
		.returning();

	if (!deleted) {
		return error(404, 'Item not found');
	}

	return { success: true };
});

export const getPantryItems = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const items = await db
		.select()
		.from(pantryItems)
		.where(eq(pantryItems.userId, locals.user.id))
		.orderBy(desc(pantryItems.createdAt));

	return items.map((item) => ({
		id: item.id,
		name: item.name,
		category: item.category,
		quantity: item.quantity,
		unit: item.unit,
		createdAt: item.createdAt.toISOString()
	}));
});

export const clearPantry = command(z.object({}), async () => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	await db.delete(pantryItems).where(eq(pantryItems.userId, locals.user.id));

	return { success: true };
});
