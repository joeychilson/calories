import { tool } from 'ai';
import { and, desc, eq, gte, like, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import {
	foodPreferences,
	mealLogs,
	pantryCategoryValues,
	pantryItems,
	preferenceCategoryValues,
	profiles,
	shoppingListItems,
	shoppingLists,
	waterLogs,
	weightLogs
} from './schema';

type ToolContext = {
	userId: string;
	timezone?: string;
};

function getTodayInTimezone(timezone?: string): string {
	const now = new Date();
	const formatter = new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone || 'UTC',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});
	return formatter.format(now);
}

export function getToolContext(context: unknown): ToolContext {
	const ctx = context as ToolContext;
	if (!ctx?.userId) {
		throw new Error('Invalid tool execution context: missing userId');
	}
	return ctx;
}

export const suggestFood = tool({
	description: 'Suggest a food item that the user can log to their diary',
	inputSchema: z.object({
		name: z.string().max(200).describe('The name of the food or meal'),
		calories: z.number().int().nonnegative().max(50000).describe('Estimated calories'),
		protein: z.number().int().nonnegative().max(5000).describe('Protein in grams'),
		carbs: z.number().int().nonnegative().max(5000).describe('Carbohydrates in grams'),
		fat: z.number().int().nonnegative().max(5000).describe('Fat in grams')
	})
});

export const managePreference = tool({
	description: `Manage user food preferences. Use this to remember or update what the user likes, dislikes, allergies, dietary restrictions, etc.

CREATE: Add a new preference when you learn something about the user.
UPDATE: Modify an existing preference (e.g., update notes or change category).
DELETE: Remove a preference when it no longer applies (e.g., "I actually like mushrooms now").`,
	inputSchema: z.object({
		operation: z.enum(['create', 'update', 'delete']).describe('Operation to perform'),
		category: z
			.enum(preferenceCategoryValues)
			.describe(
				'Type of preference: like, dislike, allergy, dietary, cuisine, timing, portion, other'
			),
		value: z.string().describe('The preference value, e.g., "mushrooms", "vegetarian", "italian"'),
		notes: z
			.string()
			.optional()
			.describe('Optional context, e.g., "texture issue", "religious reasons"')
	}),
	execute: async (input, { experimental_context: context }) => {
		const ctx = getToolContext(context);
		const { operation, category, value, notes } = input;

		const [existing] = await db
			.select()
			.from(foodPreferences)
			.where(
				and(
					eq(foodPreferences.userId, ctx.userId),
					eq(foodPreferences.category, category),
					eq(foodPreferences.value, value.toLowerCase())
				)
			);

		if (operation === 'delete') {
			if (!existing) {
				return { success: false, error: 'Preference not found' };
			}
			await db.delete(foodPreferences).where(eq(foodPreferences.id, existing.id));
			return { success: true, deleted: true };
		}

		if (operation === 'update') {
			if (!existing) {
				return { success: false, error: 'Preference not found' };
			}
			await db
				.update(foodPreferences)
				.set({ notes, updatedAt: new Date() })
				.where(eq(foodPreferences.id, existing.id));
			return { success: true, updated: true };
		}

		if (existing) {
			if (notes) {
				await db
					.update(foodPreferences)
					.set({ notes, updatedAt: new Date() })
					.where(eq(foodPreferences.id, existing.id));
			}
			return { success: true, already_existed: true };
		}

		await db.insert(foodPreferences).values({
			userId: ctx.userId,
			category,
			value: value.toLowerCase(),
			notes
		});

		return { success: true, created: true };
	}
});

export const queryMealHistory = tool({
	description: `Query the user's meal history. Use this to:
- Look up what the user ate recently
- Find meals on a specific date
- Search for specific foods they've logged
- Analyze eating patterns over time
- Answer questions like "What did I have for lunch yesterday?" or "When did I last eat pizza?"`,
	inputSchema: z.object({
		query: z
			.enum(['recent', 'by_date', 'search', 'date_range'])
			.describe('Type of query to perform'),
		date: z.string().optional().describe('Date in YYYY-MM-DD format (for by_date query)'),
		startDate: z
			.string()
			.optional()
			.describe('Start date in YYYY-MM-DD format (for date_range query)'),
		endDate: z.string().optional().describe('End date in YYYY-MM-DD format (for date_range query)'),
		searchTerm: z
			.string()
			.max(200)
			.optional()
			.describe('Food name to search for (for search query)'),
		limit: z
			.number()
			.int()
			.min(1)
			.max(100)
			.optional()
			.default(10)
			.describe('Maximum number of results to return (1-100)')
	}),
	execute: async (input, { experimental_context: context }) => {
		const ctx = getToolContext(context);
		const { query, date, startDate, endDate, searchTerm, limit } = input;

		const mealSelect = {
			id: mealLogs.id,
			name: mealLogs.name,
			calories: mealLogs.calories,
			protein: mealLogs.protein,
			carbs: mealLogs.carbs,
			fat: mealLogs.fat,
			servings: mealLogs.servings,
			date: mealLogs.date,
			loggedAt: mealLogs.loggedAt
		};

		let meals;

		switch (query) {
			case 'recent':
				meals = await db
					.select(mealSelect)
					.from(mealLogs)
					.where(eq(mealLogs.userId, ctx.userId))
					.orderBy(desc(mealLogs.loggedAt))
					.limit(limit || 10);
				break;

			case 'by_date':
				if (!date) {
					return { success: false, error: 'Date is required for by_date query' };
				}
				meals = await db
					.select(mealSelect)
					.from(mealLogs)
					.where(and(eq(mealLogs.userId, ctx.userId), eq(mealLogs.date, date)))
					.orderBy(desc(mealLogs.loggedAt));
				break;

			case 'search':
				if (!searchTerm) {
					return { success: false, error: 'Search term is required for search query' };
				}
				meals = await db
					.select(mealSelect)
					.from(mealLogs)
					.where(and(eq(mealLogs.userId, ctx.userId), like(mealLogs.name, `%${searchTerm}%`)))
					.orderBy(desc(mealLogs.loggedAt))
					.limit(limit || 10);
				break;

			case 'date_range':
				if (!startDate || !endDate) {
					return { success: false, error: 'Start and end dates are required for date_range query' };
				}
				meals = await db
					.select(mealSelect)
					.from(mealLogs)
					.where(
						and(
							eq(mealLogs.userId, ctx.userId),
							gte(mealLogs.date, startDate),
							lte(mealLogs.date, endDate)
						)
					)
					.orderBy(desc(mealLogs.loggedAt))
					.limit(limit || 50);
				break;

			default:
				return { success: false, error: 'Invalid query type' };
		}

		const totals = meals.reduce(
			(acc, meal) => ({
				calories: acc.calories + (meal.calories || 0),
				protein: acc.protein + (meal.protein || 0),
				carbs: acc.carbs + (meal.carbs || 0),
				fat: acc.fat + (meal.fat || 0)
			}),
			{ calories: 0, protein: 0, carbs: 0, fat: 0 }
		);

		return {
			success: true,
			count: meals.length,
			meals: meals.map((m) => ({
				...m,
				loggedAt: m.loggedAt.toISOString()
			})),
			totals
		};
	}
});

export const queryWeightHistory = tool({
	description: `Query the user's weight history and progress. Use this to:
- Check recent weight entries
- Track progress toward weight goal
- Analyze weight trends over time
- Answer questions like "How much have I lost?" or "What was my weight last week?"`,
	inputSchema: z.object({
		query: z
			.enum(['recent', 'progress', 'date_range'])
			.describe('Type of query: recent entries, progress summary, or date range'),
		limit: z
			.number()
			.optional()
			.default(10)
			.describe('Number of entries to return (for recent query)'),
		startDate: z
			.string()
			.optional()
			.describe('Start date in YYYY-MM-DD format (for date_range query)'),
		endDate: z.string().optional().describe('End date in YYYY-MM-DD format (for date_range query)')
	}),
	execute: async (input, { experimental_context: context }) => {
		const ctx = getToolContext(context);
		const { query, limit, startDate, endDate } = input;

		const [userProfile] = await db.select().from(profiles).where(eq(profiles.userId, ctx.userId));

		const weightUnit = userProfile?.units === 'metric' ? 'kg' : 'lbs';
		const weightGoal = userProfile?.weightGoal;

		const weightSelect = {
			id: weightLogs.id,
			weight: weightLogs.weight,
			date: weightLogs.date
		};

		let weights;

		switch (query) {
			case 'recent':
				weights = await db
					.select(weightSelect)
					.from(weightLogs)
					.where(eq(weightLogs.userId, ctx.userId))
					.orderBy(desc(weightLogs.date))
					.limit(limit || 10);
				break;

			case 'progress': {
				weights = await db
					.select(weightSelect)
					.from(weightLogs)
					.where(eq(weightLogs.userId, ctx.userId))
					.orderBy(desc(weightLogs.date));

				if (weights.length === 0) {
					return {
						success: true,
						message: 'No weight entries recorded yet',
						weightUnit,
						weightGoal
					};
				}

				const currentWeight = weights[0].weight;
				const startingWeight = weights[weights.length - 1].weight;
				const totalChange = currentWeight - startingWeight;

				const now = new Date();
				const sevenDaysAgo = new Date(now);
				sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
				const thirtyDaysAgo = new Date(now);
				thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
				const weekAgoStr = sevenDaysAgo.toISOString().split('T')[0];
				const monthAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

				const weekAgoEntry = weights.find((w) => w.date <= weekAgoStr);
				const monthAgoEntry = weights.find((w) => w.date <= monthAgoStr);

				return {
					success: true,
					currentWeight,
					startingWeight,
					totalChange: parseFloat(totalChange.toFixed(1)),
					weightGoal,
					remainingToGoal: weightGoal ? parseFloat((currentWeight - weightGoal).toFixed(1)) : null,
					weeklyChange: weekAgoEntry
						? parseFloat((currentWeight - weekAgoEntry.weight).toFixed(1))
						: null,
					monthlyChange: monthAgoEntry
						? parseFloat((currentWeight - monthAgoEntry.weight).toFixed(1))
						: null,
					totalEntries: weights.length,
					firstEntry: weights[weights.length - 1].date,
					lastEntry: weights[0].date,
					weightUnit
				};
			}

			case 'date_range':
				if (!startDate || !endDate) {
					return { success: false, error: 'Start and end dates required for date_range query' };
				}
				weights = await db
					.select(weightSelect)
					.from(weightLogs)
					.where(
						and(
							eq(weightLogs.userId, ctx.userId),
							gte(weightLogs.date, startDate),
							lte(weightLogs.date, endDate)
						)
					)
					.orderBy(desc(weightLogs.date));
				break;

			default:
				return { success: false, error: 'Invalid query type' };
		}

		return {
			success: true,
			count: weights.length,
			entries: weights,
			weightUnit,
			weightGoal
		};
	}
});

export const updateGoals = tool({
	description: `Update the user's calorie goal or weight goal. Use this when the user wants to:
- Change their daily calorie target
- Set or update their target weight
- Adjust goals based on progress or new objectives

Examples: "Set my calorie goal to 1800", "I want to reach 150 lbs", "Lower my daily target by 200 calories"`,
	inputSchema: z.object({
		calorieGoal: z
			.number()
			.int()
			.min(1000)
			.max(5000)
			.optional()
			.describe('New daily calorie goal (1000-5000)'),
		weightGoal: z
			.number()
			.positive()
			.max(1500)
			.optional()
			.describe("New target weight (in user's preferred unit, max 1500)")
	}),
	execute: async (input, { experimental_context: context }) => {
		const ctx = getToolContext(context);
		const { calorieGoal, weightGoal } = input;

		if (!calorieGoal && !weightGoal) {
			return {
				success: false,
				error: 'At least one goal (calorieGoal or weightGoal) must be provided'
			};
		}

		const [currentSettings] = await db
			.select()
			.from(profiles)
			.where(eq(profiles.userId, ctx.userId));

		const updateData: { calorieGoal?: number; weightGoal?: number; updatedAt: Date } = {
			updatedAt: new Date()
		};

		if (calorieGoal) {
			updateData.calorieGoal = calorieGoal;
		}

		if (weightGoal) {
			updateData.weightGoal = weightGoal;
		}

		if (currentSettings) {
			await db.update(profiles).set(updateData).where(eq(profiles.userId, ctx.userId));
		} else {
			await db.insert(profiles).values({
				userId: ctx.userId,
				calorieGoal: calorieGoal || 2200,
				weightGoal: weightGoal
			});
		}

		return {
			success: true,
			updated: {
				calorieGoal: calorieGoal || currentSettings?.calorieGoal,
				weightGoal: weightGoal || currentSettings?.weightGoal
			}
		};
	}
});

export const logWeight = tool({
	description: `Log a weight entry for the user. Use this when:
- User mentions their current weight ("I weigh 175 lbs today")
- User wants to record a weigh-in
- Updating progress tracking

Always confirm the weight was logged successfully.`,
	inputSchema: z.object({
		weight: z
			.number()
			.positive()
			.max(1500)
			.describe('The weight value to log (max 1500 lbs or ~680 kg)'),
		date: z
			.string()
			.optional()
			.describe('Date for the entry in YYYY-MM-DD format (defaults to today)')
	}),
	execute: async (input, { experimental_context: context }) => {
		const ctx = getToolContext(context);
		const { weight, date } = input;

		const [userProfile] = await db.select().from(profiles).where(eq(profiles.userId, ctx.userId));

		const weightUnit = userProfile?.units === 'metric' ? 'kg' : 'lbs';
		const dateStr = date || getTodayInTimezone(ctx.timezone);

		const existingEntry = await db
			.select()
			.from(weightLogs)
			.where(and(eq(weightLogs.userId, ctx.userId), eq(weightLogs.date, dateStr)));

		if (existingEntry.length > 0) {
			await db
				.update(weightLogs)
				.set({ weight, loggedAt: new Date(), updatedAt: new Date() })
				.where(eq(weightLogs.id, existingEntry[0].id));

			return {
				success: true,
				updated: true,
				weight,
				weightUnit,
				date: dateStr
			};
		}

		await db.insert(weightLogs).values({
			userId: ctx.userId,
			weight,
			date: dateStr,
			loggedAt: new Date()
		});

		const [previousEntry] = await db
			.select()
			.from(weightLogs)
			.where(eq(weightLogs.userId, ctx.userId))
			.orderBy(desc(weightLogs.date))
			.limit(2);

		const previousWeight = previousEntry?.weight;
		const change = previousWeight ? parseFloat((weight - previousWeight).toFixed(1)) : null;

		return {
			success: true,
			created: true,
			weight,
			weightUnit,
			date: dateStr,
			previousWeight,
			change,
			weightGoal: userProfile?.weightGoal
		};
	}
});

export const logWater = tool({
	description: `Log water intake for the user. Use this when:
- User mentions drinking water ("I just had a glass of water", "drank 16oz of water")
- User wants to track their hydration
- Any mention of water consumption

Common amounts:
- Glass of water: ~8 oz / 240ml
- Bottle of water: ~16-20 oz / 500ml
- Large bottle: ~32 oz / 1000ml`,
	inputSchema: z.object({
		amount: z
			.number()
			.int()
			.positive()
			.max(5000)
			.describe("Amount of water in user's preferred unit (oz for imperial, ml for metric)"),
		date: z
			.string()
			.optional()
			.describe('Date for the entry in YYYY-MM-DD format (defaults to today)')
	}),
	execute: async (input, { experimental_context: context }) => {
		const ctx = getToolContext(context);
		const { amount, date } = input;

		const [userProfile] = await db.select().from(profiles).where(eq(profiles.userId, ctx.userId));

		const waterUnit = userProfile?.units === 'metric' ? 'ml' : 'oz';
		const waterGoal = userProfile?.waterGoal ?? (userProfile?.units === 'metric' ? 2000 : 64);
		const dateStr = date || getTodayInTimezone(ctx.timezone);

		const [existing] = await db
			.select()
			.from(waterLogs)
			.where(and(eq(waterLogs.userId, ctx.userId), eq(waterLogs.date, dateStr)));

		let newTotal: number;

		if (existing) {
			newTotal = existing.amount + amount;
			await db
				.update(waterLogs)
				.set({ amount: newTotal, loggedAt: new Date(), updatedAt: new Date() })
				.where(eq(waterLogs.id, existing.id));
		} else {
			newTotal = amount;
			await db.insert(waterLogs).values({
				userId: ctx.userId,
				amount: newTotal,
				date: dateStr,
				loggedAt: new Date()
			});
		}

		const remaining = Math.max(0, waterGoal - newTotal);
		const percentComplete = Math.round((newTotal / waterGoal) * 100);

		return {
			success: true,
			logged: amount,
			total: newTotal,
			waterUnit,
			waterGoal,
			remaining,
			percentComplete,
			goalReached: newTotal >= waterGoal,
			date: dateStr
		};
	}
});

export const deleteMeal = tool({
	description: `Delete a meal from the user's log. Use this when:
- User wants to remove a logged meal ("delete that pizza", "remove my lunch")
- User says they didn't actually eat something
- Correcting a mistaken entry

Use queryMealHistory first to find the meal ID if needed.`,
	inputSchema: z.object({
		mealId: z.string().describe('The ID of the meal to delete')
	}),
	execute: async (input, { experimental_context: context }) => {
		const ctx = getToolContext(context);
		const { mealId } = input;

		const [meal] = await db
			.select()
			.from(mealLogs)
			.where(and(eq(mealLogs.id, mealId), eq(mealLogs.userId, ctx.userId)));

		if (!meal) {
			return { success: false, error: 'Meal not found' };
		}

		await db.delete(mealLogs).where(eq(mealLogs.id, mealId));

		return {
			success: true,
			deleted: {
				id: meal.id,
				name: meal.name,
				calories: meal.calories,
				date: meal.date
			}
		};
	}
});

export const editMeal = tool({
	description: `Edit an existing meal entry. Use this when:
- User wants to change the servings ("that was 2 servings not 1")
- User wants to correct calories or macros
- User wants to rename the meal
- Any modification to an existing logged meal

Use queryMealHistory first to find the meal ID if needed.`,
	inputSchema: z.object({
		mealId: z.string().describe('The ID of the meal to edit'),
		name: z.string().max(200).optional().describe('New name for the meal'),
		calories: z.number().int().positive().max(50000).optional().describe('Updated calories'),
		protein: z
			.number()
			.int()
			.nonnegative()
			.max(5000)
			.optional()
			.describe('Updated protein in grams'),
		carbs: z.number().int().nonnegative().max(5000).optional().describe('Updated carbs in grams'),
		fat: z.number().int().nonnegative().max(5000).optional().describe('Updated fat in grams'),
		servings: z.number().positive().max(100).optional().describe('Updated number of servings')
	}),
	execute: async (input, { experimental_context: context }) => {
		const ctx = getToolContext(context);
		const { mealId, name, calories, protein, carbs, fat, servings } = input;

		const [meal] = await db
			.select()
			.from(mealLogs)
			.where(and(eq(mealLogs.id, mealId), eq(mealLogs.userId, ctx.userId)));

		if (!meal) {
			return { success: false, error: 'Meal not found' };
		}

		const updateData: {
			name?: string;
			calories?: number;
			protein?: number;
			carbs?: number;
			fat?: number;
			servings?: number;
			updatedAt: Date;
		} = { updatedAt: new Date() };

		if (name !== undefined) updateData.name = name;
		if (calories !== undefined) updateData.calories = calories;
		if (protein !== undefined) updateData.protein = protein;
		if (carbs !== undefined) updateData.carbs = carbs;
		if (fat !== undefined) updateData.fat = fat;
		if (servings !== undefined) updateData.servings = servings;

		await db.update(mealLogs).set(updateData).where(eq(mealLogs.id, mealId));

		const [updatedMeal] = await db.select().from(mealLogs).where(eq(mealLogs.id, mealId));

		return {
			success: true,
			previous: {
				name: meal.name,
				calories: meal.calories,
				protein: meal.protein,
				carbs: meal.carbs,
				fat: meal.fat,
				servings: meal.servings
			},
			updated: {
				id: updatedMeal.id,
				name: updatedMeal.name,
				calories: updatedMeal.calories,
				protein: updatedMeal.protein,
				carbs: updatedMeal.carbs,
				fat: updatedMeal.fat,
				servings: updatedMeal.servings,
				date: updatedMeal.date
			}
		};
	}
});

export const queryPantry = tool({
	description: `Query the user's pantry/refrigerator to see what ingredients they have available. Use this to:
- See all available ingredients
- Filter by category (protein, vegetable, fruit, dairy, grain, pantry, beverage)
- Find specific ingredients
- Help suggest meals based on what they have`,
	inputSchema: z.object({
		category: z
			.enum(pantryCategoryValues)
			.optional()
			.describe(
				'Filter by category (protein, vegetable, fruit, dairy, grain, pantry, beverage, other)'
			),
		search: z.string().optional().describe('Search for specific item by name')
	}),
	execute: async (input, { experimental_context: context }) => {
		const ctx = getToolContext(context);
		const { category, search } = input;

		const items = await db
			.select({
				id: pantryItems.id,
				name: pantryItems.name,
				category: pantryItems.category,
				quantity: pantryItems.quantity,
				unit: pantryItems.unit
			})
			.from(pantryItems)
			.where(eq(pantryItems.userId, ctx.userId))
			.orderBy(desc(pantryItems.createdAt));

		let filtered = items;

		if (category) {
			filtered = filtered.filter((item) => item.category === category);
		}

		if (search) {
			const searchLower = search.toLowerCase();
			filtered = filtered.filter((item) => item.name.toLowerCase().includes(searchLower));
		}

		const grouped: Record<string, typeof items> = {};
		for (const item of filtered) {
			const cat = item.category || 'other';
			if (!grouped[cat]) grouped[cat] = [];
			grouped[cat].push(item);
		}

		return {
			success: true,
			totalItems: filtered.length,
			byCategory: Object.fromEntries(
				Object.entries(grouped).map(([cat, catItems]) => [
					cat,
					catItems.map((i) => ({
						id: i.id,
						name: i.name,
						quantity: i.quantity,
						unit: i.unit
					}))
				])
			)
		};
	}
});

export const managePantryItem = tool({
	description: `Add, update, or remove items from the user's pantry. Use this when:
- User mentions buying groceries ("I just bought chicken")
- User says they used something up ("I'm out of eggs")
- User wants to add or remove pantry items

Operations:
- add: Add a new item to the pantry
- update: Modify an existing item (quantity, expiration, etc.)
- delete: Remove an item from the pantry`,
	inputSchema: z.object({
		operation: z.enum(['add', 'update', 'delete']).describe('Operation to perform'),
		name: z.string().max(200).describe('Name of the item'),
		category: z
			.enum(pantryCategoryValues)
			.optional()
			.describe('Category: protein, vegetable, fruit, dairy, grain, pantry, beverage, other'),
		quantity: z.number().nonnegative().max(10000).optional().describe('Quantity of the item'),
		unit: z.string().max(50).optional().describe('Unit (lbs, oz, count, etc.)'),
		itemId: z.string().optional().describe('Item ID (required for update/delete)')
	}),
	execute: async (input, { experimental_context: context }) => {
		const ctx = getToolContext(context);
		const { operation, name, category, quantity, unit, itemId } = input;

		if (operation === 'delete') {
			if (itemId) {
				const [deleted] = await db
					.delete(pantryItems)
					.where(and(eq(pantryItems.id, itemId), eq(pantryItems.userId, ctx.userId)))
					.returning();

				if (!deleted) {
					return { success: false, error: 'Item not found' };
				}

				return { success: true, deleted: { id: deleted.id, name: deleted.name } };
			} else {
				const [existing] = await db
					.select()
					.from(pantryItems)
					.where(and(eq(pantryItems.userId, ctx.userId), like(pantryItems.name, `%${name}%`)))
					.limit(1);

				if (!existing) {
					return { success: false, error: `Item "${name}" not found in pantry` };
				}

				await db.delete(pantryItems).where(eq(pantryItems.id, existing.id));

				return { success: true, deleted: { id: existing.id, name: existing.name } };
			}
		}

		if (operation === 'update') {
			if (!itemId) {
				return { success: false, error: 'Item ID required for update' };
			}

			const updateData: Record<string, unknown> = { updatedAt: new Date() };
			if (name) updateData.name = name;
			if (category) updateData.category = category;
			if (quantity !== undefined) updateData.quantity = quantity;
			if (unit !== undefined) updateData.unit = unit;

			const [updated] = await db
				.update(pantryItems)
				.set(updateData)
				.where(and(eq(pantryItems.id, itemId), eq(pantryItems.userId, ctx.userId)))
				.returning();

			if (!updated) {
				return { success: false, error: 'Item not found' };
			}

			return {
				success: true,
				updated: {
					id: updated.id,
					name: updated.name,
					category: updated.category,
					quantity: updated.quantity,
					unit: updated.unit
				}
			};
		}

		const [newItem] = await db
			.insert(pantryItems)
			.values({
				userId: ctx.userId,
				name,
				category,
				quantity,
				unit
			})
			.returning();

		return {
			success: true,
			added: {
				id: newItem.id,
				name: newItem.name,
				category: newItem.category,
				quantity: newItem.quantity,
				unit: newItem.unit
			}
		};
	}
});

const DEFAULT_SHOPPING_LIST_NAME = 'Shopping List';

export const queryShoppingLists = tool({
	description: `Query the user's shopping lists to see what they need to buy. Use this to:
- View all shopping lists and their items
- Check what's on a specific list
- See what items are checked off vs still needed
- Help plan grocery trips`,
	inputSchema: z.object({
		listName: z.string().optional().describe('Filter to a specific list by name')
	}),
	execute: async (input, { experimental_context: context }) => {
		const ctx = getToolContext(context);
		const { listName } = input;

		const lists = await db
			.select()
			.from(shoppingLists)
			.where(eq(shoppingLists.userId, ctx.userId))
			.orderBy(desc(shoppingLists.updatedAt));

		let filteredLists = lists;
		if (listName) {
			filteredLists = lists.filter((l) => l.name.toLowerCase().includes(listName.toLowerCase()));
		}

		const listsWithItems = await Promise.all(
			filteredLists.map(async (list) => {
				const items = await db
					.select({
						id: shoppingListItems.id,
						name: shoppingListItems.name,
						category: shoppingListItems.category,
						quantity: shoppingListItems.quantity,
						unit: shoppingListItems.unit,
						checked: shoppingListItems.checked
					})
					.from(shoppingListItems)
					.where(eq(shoppingListItems.listId, list.id))
					.orderBy(shoppingListItems.checked, desc(shoppingListItems.createdAt));

				return {
					id: list.id,
					name: list.name,
					itemCount: items.length,
					checkedCount: items.filter((i) => i.checked).length,
					items
				};
			})
		);

		return {
			success: true,
			totalLists: listsWithItems.length,
			lists: listsWithItems
		};
	}
});

export const manageShoppingList = tool({
	description: `Create, rename, or delete shopping lists. Use this when:
- User wants to create a new shopping list ("create a Costco list")
- User wants to rename a list
- User wants to delete a list`,
	inputSchema: z.object({
		operation: z.enum(['create', 'rename', 'delete']).describe('Operation to perform'),
		name: z.string().max(100).describe('Name of the list (for create/rename)'),
		listId: z.string().optional().describe('List ID (required for rename/delete)')
	}),
	execute: async (input, { experimental_context: context }) => {
		const ctx = getToolContext(context);
		const { operation, name, listId } = input;

		if (operation === 'delete') {
			if (!listId) {
				return { success: false, error: 'List ID required for delete' };
			}

			const [deleted] = await db
				.delete(shoppingLists)
				.where(and(eq(shoppingLists.id, listId), eq(shoppingLists.userId, ctx.userId)))
				.returning();

			if (!deleted) {
				return { success: false, error: 'List not found' };
			}

			return { success: true, deleted: { id: deleted.id, name: deleted.name } };
		}

		if (operation === 'rename') {
			if (!listId) {
				return { success: false, error: 'List ID required for rename' };
			}

			const [updated] = await db
				.update(shoppingLists)
				.set({ name, updatedAt: new Date() })
				.where(and(eq(shoppingLists.id, listId), eq(shoppingLists.userId, ctx.userId)))
				.returning();

			if (!updated) {
				return { success: false, error: 'List not found' };
			}

			return { success: true, updated: { id: updated.id, name: updated.name } };
		}

		const [newList] = await db
			.insert(shoppingLists)
			.values({
				userId: ctx.userId,
				name
			})
			.returning();

		return {
			success: true,
			created: { id: newList.id, name: newList.name }
		};
	}
});

export const addToShoppingList = tool({
	description: `Add items to a shopping list. Use this when:
- User wants to add items to their shopping list
- Suggesting a meal that requires ingredients the user doesn't have
- User asks to remember to buy something

If no list is specified, items will be added to the default "Shopping List" (created if it doesn't exist).`,
	inputSchema: z.object({
		items: z
			.array(
				z.object({
					name: z.string().max(200).describe('Name of the item'),
					category: z
						.enum(pantryCategoryValues)
						.optional()
						.describe('Category: protein, vegetable, fruit, dairy, grain, pantry, beverage, other'),
					quantity: z.number().positive().optional().describe('Quantity'),
					unit: z.string().max(50).optional().describe('Unit (lbs, oz, count, etc.)')
				})
			)
			.describe('Items to add to the shopping list'),
		listName: z
			.string()
			.optional()
			.describe('Name of the list to add to (defaults to "Shopping List")')
	}),
	execute: async (input, { experimental_context: context }) => {
		const ctx = getToolContext(context);
		const { items, listName } = input;

		if (items.length === 0) {
			return { success: false, error: 'No items provided' };
		}

		const targetListName = listName || DEFAULT_SHOPPING_LIST_NAME;
		let [list] = await db
			.select()
			.from(shoppingLists)
			.where(and(eq(shoppingLists.userId, ctx.userId), eq(shoppingLists.name, targetListName)));

		if (!list) {
			[list] = await db
				.insert(shoppingLists)
				.values({
					userId: ctx.userId,
					name: targetListName
				})
				.returning();
		}

		const insertedItems = await db
			.insert(shoppingListItems)
			.values(
				items.map((item) => ({
					listId: list.id,
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
			.where(eq(shoppingLists.id, list.id));

		return {
			success: true,
			listName: list.name,
			addedCount: insertedItems.length,
			items: insertedItems.map((i) => ({
				id: i.id,
				name: i.name,
				category: i.category,
				quantity: i.quantity,
				unit: i.unit
			}))
		};
	}
});

export const removeFromShoppingList = tool({
	description: `Remove items from a shopping list. Use this when:
- User says they don't need something anymore
- User already has an item
- Correcting a mistake`,
	inputSchema: z.object({
		itemIds: z.array(z.string()).optional().describe('Specific item IDs to remove'),
		itemNames: z.array(z.string()).optional().describe('Item names to search for and remove'),
		listName: z
			.string()
			.optional()
			.describe('List to remove from (searches all lists if not specified)')
	}),
	execute: async (input, { experimental_context: context }) => {
		const ctx = getToolContext(context);
		const { itemIds, itemNames, listName } = input;

		if (!itemIds?.length && !itemNames?.length) {
			return { success: false, error: 'Must provide itemIds or itemNames' };
		}

		const removed: { id: string; name: string }[] = [];

		if (itemIds?.length) {
			for (const itemId of itemIds) {
				const [item] = await db
					.select({ item: shoppingListItems, list: shoppingLists })
					.from(shoppingListItems)
					.innerJoin(shoppingLists, eq(shoppingListItems.listId, shoppingLists.id))
					.where(and(eq(shoppingListItems.id, itemId), eq(shoppingLists.userId, ctx.userId)));

				if (item) {
					await db.delete(shoppingListItems).where(eq(shoppingListItems.id, itemId));
					removed.push({ id: item.item.id, name: item.item.name });
				}
			}
		}

		if (itemNames?.length) {
			for (const itemName of itemNames) {
				const items = await db
					.select({ item: shoppingListItems, list: shoppingLists })
					.from(shoppingListItems)
					.innerJoin(shoppingLists, eq(shoppingListItems.listId, shoppingLists.id))
					.where(
						and(
							eq(shoppingLists.userId, ctx.userId),
							like(shoppingListItems.name, `%${itemName}%`),
							listName ? eq(shoppingLists.name, listName) : undefined
						)
					);

				for (const item of items) {
					await db.delete(shoppingListItems).where(eq(shoppingListItems.id, item.item.id));
					removed.push({ id: item.item.id, name: item.item.name });
				}
			}
		}

		return {
			success: true,
			removedCount: removed.length,
			removed
		};
	}
});

export const markShoppingItemsBought = tool({
	description: `Mark shopping list items as bought and optionally add them to the pantry. Use this when:
- User says they bought items from their list
- User completed their shopping trip
- Moving purchased items to pantry inventory`,
	inputSchema: z.object({
		itemIds: z.array(z.string()).describe('IDs of items to mark as bought'),
		addToPantry: z
			.boolean()
			.default(true)
			.describe('Whether to add bought items to the pantry (default: true)')
	}),
	execute: async (input, { experimental_context: context }) => {
		const ctx = getToolContext(context);
		const { itemIds, addToPantry } = input;

		if (itemIds.length === 0) {
			return { success: false, error: 'No items provided' };
		}

		const items = await db
			.select({ item: shoppingListItems, list: shoppingLists })
			.from(shoppingListItems)
			.innerJoin(shoppingLists, eq(shoppingListItems.listId, shoppingLists.id))
			.where(eq(shoppingLists.userId, ctx.userId));

		const validItems = items.filter((i) => itemIds.includes(i.item.id));

		if (validItems.length === 0) {
			return { success: false, error: 'No valid items found' };
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
		if (addToPantry) {
			await db.insert(pantryItems).values(
				validItems.map((i) => ({
					userId: ctx.userId,
					name: i.item.name,
					category: i.item.category,
					quantity: i.item.quantity,
					unit: i.item.unit
				}))
			);
			addedToPantry = validItems.length;
		}

		return {
			success: true,
			markedBought: validItems.length,
			addedToPantry,
			items: validItems.map((i) => ({ id: i.item.id, name: i.item.name }))
		};
	}
});

export const assistantTools = {
	suggestFood,
	managePreference,
	queryMealHistory,
	queryWeightHistory,
	updateGoals,
	logWeight,
	logWater,
	deleteMeal,
	editMeal,
	queryPantry,
	managePantryItem,
	queryShoppingLists,
	manageShoppingList,
	addToShoppingList,
	removeFromShoppingList,
	markShoppingItemsBought
};
