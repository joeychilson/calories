import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from './openrouter';

const mealAnalysisSchema = z.object({
	isFood: z
		.boolean()
		.describe('Whether the image contains food, a meal, or a nutrition facts label'),
	rejectionReason: z
		.string()
		.optional()
		.describe(
			'If not food, explain why (e.g., "This appears to be a pet", "This is a landscape photo")'
		),
	isNutritionLabel: z
		.boolean()
		.describe('Whether the image is a nutrition facts label or packaged food with visible label'),
	name: z
		.string()
		.describe(
			'A concise, descriptive name for the meal or product (e.g., "Grilled Chicken Salad", "Pepperoni Pizza Slice", "Peanut Butter")'
		),
	servingSize: z
		.string()
		.optional()
		.describe(
			'The serving size as shown on a nutrition label (e.g., "2 tbsp", "1 cup", "3 cookies", "28g"). Only include if from a nutrition label.'
		),
	servingQuantity: z
		.number()
		.optional()
		.describe('The numeric portion of the serving size (e.g., 2 for "2 tbsp", 1 for "1 cup")'),
	servingUnit: z
		.string()
		.optional()
		.describe(
			'The unit of the serving size (e.g., "tbsp", "cup", "cookies", "g", "oz", "pieces", "slices")'
		),
	calories: z.number().int().describe('Total calories (per serving if from a nutrition label)'),
	protein: z.number().int().describe('Protein in grams (per serving if from a nutrition label)'),
	carbs: z
		.number()
		.int()
		.describe('Carbohydrates in grams (per serving if from a nutrition label)'),
	fat: z.number().int().describe('Fat in grams (per serving if from a nutrition label)')
});

export type MealAnalysis = z.infer<typeof mealAnalysisSchema>;

const SYSTEM_PROMPT = `<role>
You are an expert nutritionist and food scientist specializing in accurate nutritional analysis. You have extensive knowledge of portion sizes, cooking methods, restaurant dishes, packaged foods, and how preparation affects nutritional content.
</role>

<task>
Analyze images to extract or estimate accurate nutritional information. You handle two types of images:
1. NUTRITION FACTS LABELS - Extract exact values from the label
2. FOOD PHOTOS - Estimate nutritional content based on visual analysis
</task>

<validation>
FIRST, determine if the image contains food or a nutrition label:
- If NOT food/label (pets, people, landscapes, objects, memes, screenshots): set isFood=false, provide rejectionReason
- If food OR nutrition label: proceed with analysis
</validation>

<nutrition_label_rules>
When image shows a NUTRITION FACTS LABEL (set isNutritionLabel=true):
1. READ values exactly as printed - never estimate or round
2. EXTRACT serving size precisely: "2 tbsp (32g)", "1 cup (240ml)", "3 cookies (33g)"
3. PARSE serving into: servingQuantity (number) + servingUnit (unit like tbsp, cup, g, pieces)
4. USE product name visible on packaging for meal name
5. RETURN per-serving values exactly as labeled
6. HANDLE partially visible labels: if key values (calories, protein, carbs, fat) are visible, extract them; if not readable, set isFood=false with reason "Nutrition label not fully visible"
</nutrition_label_rules>

<food_photo_rules>
When image shows FOOD (set isNutritionLabel=false):
Do NOT include servingSize, servingQuantity, or servingUnit fields.

PORTION ESTIMATION TECHNIQUES:
- Use plate diameter (~10-12" dinner plate, ~8" salad plate) as reference
- Standard protein portion: palm-sized = ~4oz/110g = ~120-200 cal depending on meat
- Standard carb portion: fist-sized = ~1 cup = ~150-200 cal for rice/pasta
- Utensils for scale: tablespoon = 15ml, fork = ~7 inches
- Thickness matters: 1/2 inch thick chicken breast vs 1 inch changes calories significantly

CALORIE ESTIMATION GUIDELINES:
Restaurant meals typically contain MORE calories than homemade due to:
- Added butter/oil in cooking (add 100-200 cal)
- Larger portions (1.5-2x home portions)
- Sauces and dressings (50-150 cal per serving)

Common ranges:
- Fast food burger: 400-800 cal (single patty to double with cheese)
- Restaurant pasta dish: 800-1400 cal
- Salad with dressing: 300-700 cal (depends heavily on toppings/dressing)
- Pizza slice (large): 250-400 cal per slice
- Steak (8oz): 400-600 cal (before sides/butter)
- Fried chicken (piece): 200-400 cal depending on size
- Bowl (rice + protein + veg): 500-800 cal
- Sandwich/sub: 400-900 cal

COOKING METHOD MULTIPLIERS:
- Fried/deep-fried: +30-50% calories vs grilled/baked
- Cream-based sauce: +150-300 cal
- Oil-based sauce: +100-200 cal
- Breaded: +100-150 cal

MULTIPLE ITEMS: Sum all visible items. Don't forget beverages, sides, condiments.

WHEN UNCERTAIN: Estimate slightly HIGH rather than low - people chronically underestimate intake.
</food_photo_rules>

<output_format>
Round values appropriately:
- Calories: nearest 10 (e.g., 450, not 447)
- Macros: nearest gram (e.g., 25g protein, not 24.7g)
- Provide a clear, descriptive meal name (e.g., "Grilled Salmon with Rice and Vegetables" not just "Fish")
</output_format>`;

const USER_PROMPT = `Analyze this image and provide accurate nutritional information.

<step_1>
CLASSIFY THE IMAGE:
- NOT FOOD (pet, person, landscape, object, meme, screenshot) → isFood=false + rejectionReason
- NUTRITION FACTS LABEL visible → isNutritionLabel=true, extract exact values
- FOOD PHOTO → isNutritionLabel=false, estimate values
</step_1>

<step_2_nutrition_label>
If NUTRITION LABEL:
1. Read serving size exactly as printed (e.g., "2 tbsp (32g)")
2. Parse: servingQuantity=2, servingUnit="tbsp"
3. Copy calories, protein, carbs, fat exactly as labeled
4. Use visible product name for meal name
</step_2_nutrition_label>

<step_2_food_photo>
If FOOD PHOTO:
1. Identify all food items visible (main dish, sides, beverages, condiments)
2. Estimate portion sizes using visual cues (plate size, utensils, thickness)
3. Consider preparation method (fried adds calories, grilled is leaner)
4. Account for hidden calories (oils, butter, sauces, cheese)
5. Sum total nutritional content for everything visible
6. Create descriptive meal name

Remember: Restaurant/takeout food typically has 20-50% MORE calories than home-cooked due to added fats and larger portions. When uncertain, estimate HIGH.
</step_2_food_photo>`;

export async function analyzeMealFromImage(
	base64Data: string,
	mimeType: string
): Promise<MealAnalysis> {
	const { object } = await generateObject({
		model: openrouter.chat('google/gemini-2.5-flash-preview-09-2025'),
		providerOptions: {
			openrouter: { provider: { sort: 'latency' }, reasoning: { enabled: true } }
		},
		schema: mealAnalysisSchema,
		messages: [
			{
				role: 'system',
				content: SYSTEM_PROMPT
			},
			{
				role: 'user',
				content: [
					{ type: 'text', text: USER_PROMPT },
					{ type: 'image', image: base64Data, mediaType: mimeType }
				]
			}
		]
	});

	if (!object.isFood) {
		return {
			isFood: false,
			isNutritionLabel: false,
			rejectionReason: object.rejectionReason || 'This does not appear to be food.',
			name: '',
			calories: 0,
			protein: 0,
			carbs: 0,
			fat: 0
		};
	}

	return object;
}

const TEXT_SYSTEM_PROMPT = `<role>
You are an expert nutritionist with comprehensive knowledge of food composition, portion sizes, restaurant menus, home cooking, and nutritional databases like USDA FoodData Central.
</role>

<task>
Analyze text descriptions of food and provide accurate nutritional estimates. Parse quantities, identify foods, and calculate total nutritional content.
</task>

<validation>
- If text does NOT describe food (e.g., "a car", "hello", random words): isFood=false + rejectionReason
- Always set isNutritionLabel=false for text descriptions
</validation>

<parsing_rules>
QUANTITY PARSING:
- Explicit quantities: "3 tacos" = 3 tacos, "2 slices of pizza" = 2 slices
- Size modifiers: "large" = 1.5x standard, "small" = 0.7x standard
- Vague quantities: "some fries" = medium serving, "a few cookies" = 3 cookies
- No quantity specified: assume 1 standard serving

PORTION SIZE REFERENCES:
- "Slice" of pizza = 1/8 of large (14") pizza ≈ 280-350 cal
- "Bowl" of soup/rice/pasta = ~1.5-2 cups
- "Plate" of food = typical restaurant portion
- "Handful" = ~1 oz for nuts/snacks
- "Glass" of beverage = 8-12 oz
</parsing_rules>

<estimation_guidelines>
COMMON FOODS DATABASE:
- Chicken breast (6oz grilled): 280 cal, 53g protein, 0g carbs, 6g fat
- Salmon fillet (6oz): 350 cal, 40g protein, 0g carbs, 20g fat
- White rice (1 cup cooked): 200 cal, 4g protein, 45g carbs, 0g fat
- Pasta (1 cup cooked): 220 cal, 8g protein, 43g carbs, 1g fat
- Egg (large): 70 cal, 6g protein, 0g carbs, 5g fat
- Avocado (half): 160 cal, 2g protein, 9g carbs, 15g fat
- Banana (medium): 105 cal, 1g protein, 27g carbs, 0g fat

RESTAURANT VS HOMEMADE:
- Assume restaurant/takeout unless specified as "homemade"
- Restaurant portions are typically 1.5-2x larger
- Add 15-25% for cooking oils/butter used in restaurants

COMBO MEALS:
- Break down each component
- Don't forget: sauces, dressings, cheese, oils, beverages
- Sum all components for total

WHEN UNCERTAIN: Estimate on the higher end. Users typically underreport.
</estimation_guidelines>

<output_format>
- Round calories to nearest 10
- Round macros to nearest gram
- Create clear, descriptive meal name that reflects what was described
</output_format>`;

export async function analyzeMealFromText(description: string): Promise<MealAnalysis> {
	const { object } = await generateObject({
		model: openrouter.chat('google/gemini-2.5-flash-preview-09-2025'),
		providerOptions: {
			openrouter: { provider: { sort: 'latency' }, reasoning: { effort: 'high' } }
		},
		schema: mealAnalysisSchema,
		messages: [
			{
				role: 'system',
				content: TEXT_SYSTEM_PROMPT
			},
			{
				role: 'user',
				content: `Analyze this food and provide accurate nutritional information:

"${description}"

<instructions>
1. Parse the description for: food items, quantities, sizes, preparation methods
2. If restaurant/brand mentioned, use their typical portions and recipes
3. If homemade or unspecified, use standard portions
4. Calculate total calories and macros for EVERYTHING described
5. Create a clear, descriptive meal name
</instructions>`
			}
		]
	});

	if (!object.isFood) {
		return {
			isFood: false,
			isNutritionLabel: false,
			rejectionReason:
				object.rejectionReason || 'This does not appear to be a valid food description.',
			name: '',
			calories: 0,
			protein: 0,
			carbs: 0,
			fat: 0
		};
	}

	return object;
}
