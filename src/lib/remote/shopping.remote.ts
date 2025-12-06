import { command, getRequestEvent, query } from '$app/server';
import { PANTRY_CATEGORY_LABELS, PANTRY_CATEGORY_ORDER } from '$lib/constants';
import { MIME_TO_EXT } from '$lib/constants/mime';
import { analyzeShoppingList } from '$lib/server/ai';
import { db } from '$lib/server/db';
import { aiLimiter } from '$lib/server/ratelimit';
import {
	pantryCategoryValues,
	pantryItems,
	shoppingListItems,
	shoppingLists
} from '$lib/server/schema';
import {
	deleteImage,
	getImageBuffer,
	getPresignedUploadUrl,
	imageExists
} from '$lib/server/storage';
import { error } from '@sveltejs/kit';
import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

const DEFAULT_LIST_NAME = 'Shopping List';

export const getShoppingLists = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const lists = await db
		.select()
		.from(shoppingLists)
		.where(eq(shoppingLists.userId, locals.user.id))
		.orderBy(desc(shoppingLists.updatedAt));

	const listsWithItems = await Promise.all(
		lists.map(async (list) => {
			const items = await db
				.select()
				.from(shoppingListItems)
				.where(eq(shoppingListItems.listId, list.id))
				.orderBy(asc(shoppingListItems.checked), desc(shoppingListItems.createdAt));

			return {
				id: list.id,
				name: list.name,
				createdAt: list.createdAt.toISOString(),
				updatedAt: list.updatedAt.toISOString(),
				items: items.map((item) => ({
					id: item.id,
					name: item.name,
					category: item.category,
					quantity: item.quantity,
					unit: item.unit,
					checked: item.checked,
					createdAt: item.createdAt.toISOString()
				}))
			};
		})
	);

	return listsWithItems;
});

export const createShoppingList = command(
	z.object({
		name: z.string().min(1).max(100)
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const [list] = await db
			.insert(shoppingLists)
			.values({
				userId: locals.user.id,
				name: input.name
			})
			.returning();

		return {
			id: list.id,
			name: list.name,
			createdAt: list.createdAt.toISOString(),
			updatedAt: list.updatedAt.toISOString(),
			items: []
		};
	}
);

export const updateShoppingList = command(
	z.object({
		id: z.string().uuid(),
		name: z.string().min(1).max(100)
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const [updated] = await db
			.update(shoppingLists)
			.set({ name: input.name, updatedAt: new Date() })
			.where(and(eq(shoppingLists.id, input.id), eq(shoppingLists.userId, locals.user.id)))
			.returning();

		if (!updated) {
			return error(404, 'List not found');
		}

		return {
			id: updated.id,
			name: updated.name
		};
	}
);

export const deleteShoppingList = command(z.string().uuid(), async (id) => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const [deleted] = await db
		.delete(shoppingLists)
		.where(and(eq(shoppingLists.id, id), eq(shoppingLists.userId, locals.user.id)))
		.returning();

	if (!deleted) {
		return error(404, 'List not found');
	}

	return { success: true };
});

export const addShoppingListItem = command(
	z.object({
		listId: z.string().uuid(),
		name: z.string().min(1).max(200),
		category: z.enum(pantryCategoryValues).optional(),
		quantity: z.number().positive().optional(),
		unit: z.string().max(50).optional()
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const [list] = await db
			.select()
			.from(shoppingLists)
			.where(and(eq(shoppingLists.id, input.listId), eq(shoppingLists.userId, locals.user.id)));

		if (!list) {
			return error(404, 'List not found');
		}

		const [item] = await db
			.insert(shoppingListItems)
			.values({
				listId: input.listId,
				name: input.name,
				category: input.category,
				quantity: input.quantity,
				unit: input.unit
			})
			.returning();

		await db
			.update(shoppingLists)
			.set({ updatedAt: new Date() })
			.where(eq(shoppingLists.id, input.listId));

		return {
			id: item.id,
			name: item.name,
			category: item.category,
			quantity: item.quantity,
			unit: item.unit,
			checked: item.checked,
			createdAt: item.createdAt.toISOString()
		};
	}
);

export const addShoppingListItems = command(
	z.object({
		listId: z.string().uuid(),
		items: z.array(
			z.object({
				name: z.string().min(1).max(200),
				category: z.enum(pantryCategoryValues).optional(),
				quantity: z.number().positive().optional(),
				unit: z.string().max(50).optional()
			})
		)
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		if (input.items.length === 0) {
			return { added: [] };
		}

		const [list] = await db
			.select()
			.from(shoppingLists)
			.where(and(eq(shoppingLists.id, input.listId), eq(shoppingLists.userId, locals.user.id)));

		if (!list) {
			return error(404, 'List not found');
		}

		const insertedItems = await db
			.insert(shoppingListItems)
			.values(
				input.items.map((item) => ({
					listId: input.listId,
					name: item.name,
					category: item.category,
					quantity: item.quantity,
					unit: item.unit
				}))
			)
			.returning();

		await db
			.update(shoppingLists)
			.set({ updatedAt: new Date() })
			.where(eq(shoppingLists.id, input.listId));

		return {
			added: insertedItems.map((item) => ({
				id: item.id,
				name: item.name,
				category: item.category,
				quantity: item.quantity,
				unit: item.unit,
				checked: item.checked,
				createdAt: item.createdAt.toISOString()
			}))
		};
	}
);

export const updateShoppingListItem = command(
	z.object({
		id: z.string().uuid(),
		name: z.string().min(1).max(200).optional(),
		category: z.enum(pantryCategoryValues).optional(),
		quantity: z.number().positive().optional(),
		unit: z.string().max(50).optional(),
		checked: z.boolean().optional()
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const [existingItem] = await db
			.select({ item: shoppingListItems, list: shoppingLists })
			.from(shoppingListItems)
			.innerJoin(shoppingLists, eq(shoppingListItems.listId, shoppingLists.id))
			.where(and(eq(shoppingListItems.id, input.id), eq(shoppingLists.userId, locals.user.id)));

		if (!existingItem) {
			return error(404, 'Item not found');
		}

		const updateData: Record<string, unknown> = { updatedAt: new Date() };
		if (input.name !== undefined) updateData.name = input.name;
		if (input.category !== undefined) updateData.category = input.category;
		if (input.quantity !== undefined) updateData.quantity = input.quantity;
		if (input.unit !== undefined) updateData.unit = input.unit;
		if (input.checked !== undefined) updateData.checked = input.checked;

		const [updated] = await db
			.update(shoppingListItems)
			.set(updateData)
			.where(eq(shoppingListItems.id, input.id))
			.returning();

		await db
			.update(shoppingLists)
			.set({ updatedAt: new Date() })
			.where(eq(shoppingLists.id, existingItem.item.listId));

		return {
			id: updated.id,
			name: updated.name,
			category: updated.category,
			quantity: updated.quantity,
			unit: updated.unit,
			checked: updated.checked
		};
	}
);

export const deleteShoppingListItem = command(z.string().uuid(), async (id) => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const [existingItem] = await db
		.select({ item: shoppingListItems, list: shoppingLists })
		.from(shoppingListItems)
		.innerJoin(shoppingLists, eq(shoppingListItems.listId, shoppingLists.id))
		.where(and(eq(shoppingListItems.id, id), eq(shoppingLists.userId, locals.user.id)));

	if (!existingItem) {
		return error(404, 'Item not found');
	}

	await db.delete(shoppingListItems).where(eq(shoppingListItems.id, id));

	await db
		.update(shoppingLists)
		.set({ updatedAt: new Date() })
		.where(eq(shoppingLists.id, existingItem.item.listId));

	return { success: true };
});

export const toggleShoppingListItem = command(z.string().uuid(), async (id) => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const [existingItem] = await db
		.select({ item: shoppingListItems, list: shoppingLists })
		.from(shoppingListItems)
		.innerJoin(shoppingLists, eq(shoppingListItems.listId, shoppingLists.id))
		.where(and(eq(shoppingListItems.id, id), eq(shoppingLists.userId, locals.user.id)));

	if (!existingItem) {
		return error(404, 'Item not found');
	}

	const [updated] = await db
		.update(shoppingListItems)
		.set({ checked: !existingItem.item.checked, updatedAt: new Date() })
		.where(eq(shoppingListItems.id, id))
		.returning();

	return {
		id: updated.id,
		checked: updated.checked
	};
});

export const markItemsBoughtAndAddToPantry = command(
	z.object({
		itemIds: z.array(z.string().uuid()),
		addToPantry: z.boolean().default(true)
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		if (input.itemIds.length === 0) {
			return { success: true, addedToPantry: 0 };
		}

		const items = await db
			.select({ item: shoppingListItems, list: shoppingLists })
			.from(shoppingListItems)
			.innerJoin(shoppingLists, eq(shoppingListItems.listId, shoppingLists.id))
			.where(eq(shoppingLists.userId, locals.user.id));

		const validItems = items.filter((i) => input.itemIds.includes(i.item.id));

		if (validItems.length === 0) {
			return error(404, 'No valid items found');
		}

		await Promise.all(
			validItems.map((i) =>
				db
					.update(shoppingListItems)
					.set({ checked: true, updatedAt: new Date() })
					.where(eq(shoppingListItems.id, i.item.id))
			)
		);

		let addedToPantry = 0;
		if (input.addToPantry) {
			const pantryInserts = validItems.map((i) => ({
				userId: locals.user!.id,
				name: i.item.name,
				category: i.item.category,
				quantity: i.item.quantity,
				unit: i.item.unit
			}));

			await db.insert(pantryItems).values(pantryInserts);
			addedToPantry = pantryInserts.length;
		}

		const listIds = [...new Set(validItems.map((i) => i.item.listId))];
		await Promise.all(
			listIds.map((listId) =>
				db.update(shoppingLists).set({ updatedAt: new Date() }).where(eq(shoppingLists.id, listId))
			)
		);

		return { success: true, addedToPantry };
	}
);

export const clearCheckedItems = command(z.string().uuid(), async (listId) => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const [list] = await db
		.select()
		.from(shoppingLists)
		.where(and(eq(shoppingLists.id, listId), eq(shoppingLists.userId, locals.user.id)));

	if (!list) {
		return error(404, 'List not found');
	}

	await db
		.delete(shoppingListItems)
		.where(and(eq(shoppingListItems.listId, listId), eq(shoppingListItems.checked, true)));

	await db.update(shoppingLists).set({ updatedAt: new Date() }).where(eq(shoppingLists.id, listId));

	return { success: true };
});

export const getOrCreateDefaultList = command(z.object({}), async () => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const [existing] = await db
		.select()
		.from(shoppingLists)
		.where(
			and(eq(shoppingLists.userId, locals.user.id), eq(shoppingLists.name, DEFAULT_LIST_NAME))
		);

	if (existing) {
		return { id: existing.id, name: existing.name };
	}

	const [list] = await db
		.insert(shoppingLists)
		.values({
			userId: locals.user.id,
			name: DEFAULT_LIST_NAME
		})
		.returning();

	return { id: list.id, name: list.name };
});

export const getShoppingListMarkdown = command(z.string().uuid(), async (listId) => {
	const { locals } = getRequestEvent();
	if (!locals.session || !locals.user) {
		return error(401, 'Unauthorized');
	}

	const [list] = await db
		.select()
		.from(shoppingLists)
		.where(and(eq(shoppingLists.id, listId), eq(shoppingLists.userId, locals.user.id)));

	if (!list) {
		return error(404, 'List not found');
	}

	const items = await db
		.select()
		.from(shoppingListItems)
		.where(eq(shoppingListItems.listId, listId))
		.orderBy(asc(shoppingListItems.checked), desc(shoppingListItems.createdAt));

	const grouped: Record<string, typeof items> = {};
	for (const item of items) {
		const cat = item.category || 'other';
		if (!grouped[cat]) grouped[cat] = [];
		grouped[cat].push(item);
	}

	let markdown = `# ${list.name}\n\n`;

	for (const category of PANTRY_CATEGORY_ORDER) {
		if (!grouped[category] || grouped[category].length === 0) continue;

		markdown += `## ${PANTRY_CATEGORY_LABELS[category]}\n\n`;

		for (const item of grouped[category]) {
			const checkbox = item.checked ? '[x]' : '[ ]';
			const qty = item.quantity && item.unit ? ` (${item.quantity} ${item.unit})` : '';
			markdown += `- ${checkbox} ${item.name}${qty}\n`;
		}

		markdown += '\n';
	}

	return { markdown, name: list.name };
});

export const getShoppingListImageUploadUrl = command(
	z.object({ mimeType: z.string() }),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.session || !locals.user) {
			return error(401, 'Unauthorized');
		}

		const ext = MIME_TO_EXT[input.mimeType] || 'jpg';
		const timestamp = Date.now();
		const imageKey = `temp/${locals.user.id}/shopping-${timestamp}.${ext}`;
		const uploadUrl = getPresignedUploadUrl(imageKey);

		return { imageKey, uploadUrl };
	}
);

const MAX_TEXT_FILE_SIZE = 50 * 1024; // 50KB
const MAX_LINE_COUNT = 200;

export const scanShoppingList = command(
	z.union([
		z.object({
			type: z.literal('image'),
			imageKey: z.string(),
			mimeType: z.string().default('image/jpeg')
		}),
		z.object({
			type: z.literal('text'),
			content: z.string()
		})
	]),
	async (input) => {
		const event = getRequestEvent();
		if (!event.locals.session || !event.locals.user) {
			return error(401, 'Unauthorized');
		}

		if (await aiLimiter.isLimited(event)) {
			return error(429, 'Too many requests. Please try again later.');
		}

		if (input.type === 'image') {
			if (!input.imageKey.startsWith(`temp/${event.locals.user.id}/`)) {
				return error(403, 'Invalid image key');
			}

			try {
				const exists = await imageExists(input.imageKey);
				if (!exists) {
					return error(404, 'Image not found. Please try uploading again.');
				}

				const imageBuffer = await getImageBuffer(input.imageKey);
				const base64Data = imageBuffer.toString('base64');

				const analysis = await analyzeShoppingList({
					type: 'image',
					base64Data,
					mimeType: input.mimeType
				});

				await deleteImage(input.imageKey);

				if (!analysis.isValid) {
					return error(
						400,
						analysis.rejectionReason || 'Could not parse shopping list from image.'
					);
				}

				return { items: analysis.items };
			} catch (err) {
				console.error('Shopping list image analysis failed:', err);
				return error(500, 'Failed to analyze image. Please try again.');
			}
		} else {
			const content = input.content;

			const byteSize = new TextEncoder().encode(content).length;
			if (byteSize > MAX_TEXT_FILE_SIZE) {
				return error(400, 'File is too large. Please use a file under 50KB.');
			}

			let lines = content.split('\n');
			let truncated = false;
			if (lines.length > MAX_LINE_COUNT) {
				lines = lines.slice(0, MAX_LINE_COUNT);
				truncated = true;
			}

			const truncatedContent = lines.join('\n');

			try {
				const analysis = await analyzeShoppingList({
					type: 'text',
					content: truncatedContent
				});

				if (!analysis.isValid) {
					return error(400, analysis.rejectionReason || 'Could not parse shopping list from text.');
				}

				return {
					items: analysis.items,
					truncated,
					truncatedMessage: truncated
						? `List truncated to first ${MAX_LINE_COUNT} items`
						: undefined
				};
			} catch (err) {
				console.error('Shopping list text analysis failed:', err);
				return error(500, 'Failed to analyze text. Please try again.');
			}
		}
	}
);
