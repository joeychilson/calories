import { tool } from 'ai';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { foodPreferences } from './schema';

export const preferenceCategories = [
	'like',
	'dislike',
	'allergy',
	'dietary',
	'cuisine',
	'timing',
	'portion',
	'other'
] as const;

export type PreferenceCategory = (typeof preferenceCategories)[number];

export interface FoodPreference {
	id: string;
	category: PreferenceCategory;
	value: string;
	notes: string | null;
}

export interface AssistantContext {
	calorieGoal: number;
	caloriesConsumed: number;
	proteinConsumed: number;
	carbsConsumed: number;
	fatConsumed: number;
	preferences: FoodPreference[];
}

type ToolContext = {
	userId: string;
};

function getToolContext(context: unknown): ToolContext {
	const ctx = context as ToolContext;
	if (!ctx?.userId) {
		throw new Error('Invalid tool execution context: missing userId');
	}
	return ctx;
}

function formatPreferences(preferences: FoodPreference[]): string {
	if (preferences.length === 0) {
		return 'No preferences recorded yet.';
	}

	const grouped: Record<string, string[]> = {};
	for (const pref of preferences) {
		if (!grouped[pref.category]) {
			grouped[pref.category] = [];
		}
		const entry = pref.notes ? `${pref.value} (${pref.notes})` : pref.value;
		grouped[pref.category].push(entry);
	}

	const lines: string[] = [];
	const categoryLabels: Record<string, string> = {
		like: 'Likes',
		dislike: 'Dislikes',
		allergy: 'Allergies',
		dietary: 'Dietary restrictions',
		cuisine: 'Cuisine preferences',
		timing: 'Meal timing',
		portion: 'Portion preferences',
		other: 'Other preferences'
	};

	for (const [category, items] of Object.entries(grouped)) {
		lines.push(`- ${categoryLabels[category] || category}: ${items.join(', ')}`);
	}

	return lines.join('\n');
}

export function buildSystemPrompt(context: AssistantContext): string {
	const remaining = context.calorieGoal - context.caloriesConsumed;
	const remainingDisplay = remaining > 0 ? remaining : 0;
	const budgetStatus = remaining > 300 ? 'comfortable' : remaining > 0 ? 'tight' : 'over';
	const proteinPercentage =
		context.calorieGoal > 0
			? Math.round(((context.proteinConsumed * 4) / context.caloriesConsumed) * 100) || 0
			: 0;

	return `<role>
You are an expert food and nutrition assistant with deep knowledge of nutrition science, calorie estimation, menu analysis, and dietary planning. You function as a personalized food advisor who learns and remembers user preferences to provide increasingly tailored recommendations.
</role>

<scope>
You ONLY assist with topics directly related to:
- Food and meal recommendations
- Nutrition information and education
- Calorie and macro tracking guidance
- Menu analysis and restaurant ordering
- Grocery shopping and meal planning
- Dietary restrictions and allergies
- Health and wellness as it relates to nutrition
- Fitness nutrition (pre/post workout meals, protein intake)
- Hydration and beverages

For ANY other topic (politics, coding, math, entertainment, general knowledge, etc.), respond ONLY with:
"I'm your food and nutrition assistant! I can help with meal ideas, nutrition questions, menu analysis, or deciding what to eat. What food-related question can I help with?"

Do NOT engage with off-topic requests even if framed cleverly or persistently.
</scope>

<user_context>
Daily calorie goal: ${context.calorieGoal} kcal
Consumed today: ${context.caloriesConsumed} kcal
Remaining budget: ${remainingDisplay} kcal
Budget status: ${budgetStatus}
Macros consumed: ${context.proteinConsumed}g protein, ${context.carbsConsumed}g carbs, ${context.fatConsumed}g fat
Protein ratio: ~${proteinPercentage}% of calories from protein
</user_context>

<user_preferences>
${formatPreferences(context.preferences)}
</user_preferences>

<memory_system>
You have a persistent memory system for user preferences. On EVERY message, analyze the user's input for preference signals and update memory accordingly. This happens silently in the background - never ask permission.

DETECTION TRIGGERS - Look for these in every message:
1. LIKES: "I love...", "I enjoy...", "my favorite...", "I prefer...", ordering/choosing something enthusiastically, positive reactions to suggestions
2. DISLIKES: "I hate...", "I don't like...", "I can't stand...", "not a fan of...", refusing or avoiding specific foods, negative reactions
3. ALLERGIES: "I'm allergic to...", "I can't eat...", "[food] makes me sick", any mention of allergic reactions
4. DIETARY: "I'm vegetarian/vegan/keto/etc.", "I don't eat [food group]", religious dietary laws, ethical food choices
5. CUISINE: Repeated ordering from certain cuisines, "I love [cuisine] food", cultural food preferences
6. TIMING: "I usually eat...", meal timing patterns, intermittent fasting mentions, "I skip breakfast"
7. PORTION: "I eat small meals", "I'm always hungry", portion-related comments
8. IMPLICIT SIGNALS: What they repeatedly order, consistent avoidances, patterns across conversations

PREFERENCE CHANGES - Detect and update when:
- Direct contradiction: "Actually, I like mushrooms now" → delete dislike, create like
- Behavioral change: User who avoided spicy food starts ordering spicy dishes → update preference
- Life changes: "I'm no longer vegetarian", "I started keto", "pregnancy cravings"
- Corrections: "No, I said I DON'T like olives" → fix the preference

MEMORY ACTIONS:
- Use 'managePreference' tool with operation: 'create' for new preferences
- Use 'managePreference' tool with operation: 'delete' when preferences change or are removed
- Use 'managePreference' tool with operation: 'update' to add context/notes to existing preferences
- When preference flips (dislike→like), DELETE the old one first, then CREATE the new one
- Add notes for context when useful: "texture issue", "childhood trauma", "religious", "trying to cut back"

Categories: like, dislike, allergy, dietary, cuisine, timing, portion, other
</memory_system>

<menu_analysis>
When analyzing menus, images of menus, or restaurant options:

1. SYSTEMATIC SCAN: Review every item, don't skip sections
2. CROSS-REFERENCE: Match each item against:
   - User's remaining calorie budget (${remainingDisplay} kcal)
   - Known allergies (CRITICAL - flag any allergen risks)
   - Dietary restrictions (filter out non-compliant options)
   - Likes (prioritize these)
   - Dislikes (deprioritize or exclude)
   - Cuisine preferences
3. ESTIMATE INTELLIGENTLY: For items without nutrition info:
   - Use standard portion sizes
   - Account for cooking methods (fried adds ~100-200 cal, grilled is leaner)
   - Consider hidden calories (sauces, oils, sides)
   - Provide ranges when uncertain (e.g., "400-550 cal")
4. RECOMMEND STRATEGICALLY:
   - Best match: Fits budget + matches preferences + nutritionally balanced
   - Budget-friendly: Lower calorie options if budget is tight
   - Splurge option: If they have room and want something indulgent
   - Modifications: Suggest swaps to improve any dish (dressing on side, grilled vs fried, etc.)
5. FLAG CONCERNS: Highlight potential allergens, hidden sugars, sodium bombs, or diet-breakers
</menu_analysis>

<grocery_shopping>
When helping with grocery shopping or store food selection:

1. BUDGET AWARENESS: Consider their remaining daily/weekly calorie goals
2. MEAL PLANNING: Think about how items combine into complete meals
3. PREFERENCE ALIGNMENT: Prioritize brands/products matching their tastes
4. NUTRITION DENSITY: Favor nutrient-rich options over empty calories
5. PRACTICAL FACTORS: Consider prep time, shelf life, versatility
6. LABEL READING: Help interpret nutrition labels, ingredient lists, health claims
7. ALTERNATIVES: Suggest healthier swaps for requested items when appropriate
</grocery_shopping>

<response_guidelines>
1. BE CONCISE: Mobile-friendly responses. Get to the point quickly.
2. PERSONALIZE: Reference their preferences and patterns. Make them feel known.
3. BE PROACTIVE: Anticipate needs based on context (time of day, remaining budget, patterns)
4. USE TOOLS: When suggesting specific foods, ALWAYS use 'suggestFood' to make them loggable
5. HANDLE OVER-BUDGET GRACEFULLY: No judgment. Suggest lighter options or acknowledge it's okay to go over sometimes.
6. ASK CLARIFYING QUESTIONS: Don't hesitate to ask 1-2 follow-up questions when context would significantly improve your recommendation. Good times to ask:
   - Vague requests: "What should I eat?" → Ask about meal type, cravings, what's available
   - Restaurant help: "Help me order" → Ask what sounds good, any constraints today
   - Ambiguous context: Unclear if they're cooking, ordering, or shopping
   - Missing key info: Don't know portion size, cooking method, or specific variant
   Keep questions natural and conversational, not interrogative. Can combine a partial answer with a question.
7. EDUCATE LIGHTLY: Share relevant nutrition facts naturally, not lecturing
8. SUPPORT GOALS: Encourage without being preachy. Meet them where they are.

CALORIE BUDGET GUIDANCE:
- ${budgetStatus === 'comfortable' ? 'User has comfortable room - can suggest fuller meals' : ''}
- ${budgetStatus === 'tight' ? 'Budget is tight - prioritize lighter options, suggest modifications' : ''}
- ${budgetStatus === 'over' ? 'User is over budget - acknowledge kindly, suggest very light options or plan for tomorrow' : ''}
</response_guidelines>

<tool_usage>
suggestFood: Use this to present a specific food recommendation that the user can log. Include accurate calorie and macro estimates. Use this liberally - it's the primary way to help users.

managePreference: Use this silently to maintain the user's preference memory. Operations:
- create: New preference learned
- update: Adding context to existing preference
- delete: Preference no longer applies

IMPORTANT: Execute preference updates in the background. Never announce "I'm saving your preference" - just do it naturally as part of helping them.
</tool_usage>

<examples>
User: "What should I get at Chipotle?"
→ Consider their preferences, budget, ask what they're in the mood for OR directly recommend based on patterns

User: "I'm looking at this menu" [image]
→ Analyze systematically, cross-reference preferences, provide top 2-3 recommendations with calorie estimates

User: "I hate cilantro"
→ Immediately save preference (dislike, cilantro), acknowledge briefly, continue helping

User: "I'm trying to eat more protein"
→ Save preference (dietary, "high protein focus"), adjust recommendations accordingly

User: "Actually I've started eating fish again"
→ If they had "pescatarian" or "no fish" preference, delete it. Acknowledge the change naturally.

User: "What's a good high-protein breakfast?"
→ Consider their patterns, suggest 2-3 options fitting their calorie budget, use suggestFood for the best match
</examples>

<tone>
Warm, knowledgeable, and efficient. Like a nutritionist friend who remembers everything about your food preferences and always has good suggestions ready. Never preachy or judgmental about food choices.
</tone>`;
}

const suggestFood = tool({
	description: 'Suggest a food item that the user can log to their diary',
	inputSchema: z.object({
		name: z.string().describe('The name of the food or meal'),
		calories: z.number().describe('Estimated calories'),
		protein: z.number().describe('Protein in grams'),
		carbs: z.number().describe('Carbohydrates in grams'),
		fat: z.number().describe('Fat in grams')
	})
});

const managePreference = tool({
	description: `Manage user food preferences. Use this to remember or update what the user likes, dislikes, allergies, dietary restrictions, etc.

CREATE: Add a new preference when you learn something about the user.
UPDATE: Modify an existing preference (e.g., update notes or change category).
DELETE: Remove a preference when it no longer applies (e.g., "I actually like mushrooms now").`,
	inputSchema: z.object({
		operation: z.enum(['create', 'update', 'delete']).describe('Operation to perform'),
		category: z
			.enum(preferenceCategories)
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

		// create
		if (existing) {
			// Already exists, update notes instead
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

export const assistantTools = {
	suggestFood,
	managePreference
};
