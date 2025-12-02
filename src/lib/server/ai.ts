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

const SYSTEM_PROMPT = `You are a nutrition analysis expert. Your job is to analyze photos of food OR nutrition facts labels and provide accurate nutritional information.

IMPORTANT RULES:
1. Accept BOTH food photos AND nutrition facts labels as valid input.
2. If the image does NOT contain food or a nutrition label (e.g., pets, people, landscapes, random objects), set isFood to false and provide a brief rejectionReason.
3. DETECT if the image is a NUTRITION FACTS LABEL and set isNutritionLabel accordingly.

FOR NUTRITION FACTS LABELS (set isNutritionLabel to true):
- Set isFood to true (labels ARE valid input)
- READ the exact values from the label - do NOT estimate
- EXTRACT the serving size exactly as shown (e.g., "2 tbsp (32g)", "1 cup", "3 cookies")
- Parse the serving size into servingQuantity (the number) and servingUnit (the unit)
- Use the product name for the meal name
- Return values PER SERVING as shown on the label

FOR FOOD PHOTOS (set isNutritionLabel to false):
- Do NOT include servingSize, servingQuantity, or servingUnit
- Estimate portion sizes carefully based on visual cues (plate size, utensils, hands for scale)
- Be realistic with calorie estimates - don't underestimate. Most restaurant meals are 600-1200 calories.
- For homemade meals, consider typical ingredient amounts.
- If multiple items are visible, sum up the total nutritional content.

Round all numbers to reasonable values (calories to nearest 10, macros to nearest gram).`;

const USER_PROMPT = `Analyze this image and provide nutritional information.

FIRST, determine what type of image this is:
1. If NOT food or a nutrition label → set isFood to false, explain in rejectionReason
2. If a NUTRITION FACTS LABEL → set isNutritionLabel to true, READ exact values from label
3. If a FOOD PHOTO → set isNutritionLabel to false, ESTIMATE values for what's visible

FOR NUTRITION LABELS:
- Read the serving size exactly (e.g., "2 tbsp (32g)", "1 cup", "28g")
- Extract servingQuantity (number) and servingUnit (unit like "tbsp", "cup", "g", "pieces")
- Copy all nutritional values exactly as shown PER SERVING
- Use the product name for the meal name

FOR FOOD PHOTOS:
- Do NOT include servingSize, servingQuantity, or servingUnit
- Estimate nutritional values for the entire visible portion
- Be accurate but realistic - most people underestimate calories`;

export async function analyzeMealFromImage(
	base64Data: string,
	mimeType: string
): Promise<MealAnalysis> {
	const { object } = await generateObject({
		model: openrouter.chat('google/gemini-2.5-flash-preview-09-2025'),
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

const calorieOptimizationSchema = z.object({
	calories: z.number().int().describe('Recommended daily calorie intake'),
	timeline: z.string().describe('Estimated time to reach goal (e.g., "8-10 weeks", "3-4 months")'),
	explanation: z
		.string()
		.describe('Brief, friendly explanation of the recommendation (2-3 sentences max)')
});

export type CalorieOptimization = z.infer<typeof calorieOptimizationSchema>;

const CALORIE_SYSTEM_PROMPT = `You are a nutrition and weight loss expert. Calculate safe, sustainable calorie targets for weight loss.

KEY PRINCIPLES:
1. Safe weight loss is 0.5-2 lbs per week (0.25-1 kg per week)
2. Never recommend below 1200 calories for women or 1500 for men
3. A 500 calorie daily deficit = ~1 lb lost per week
4. A 1000 calorie daily deficit = ~2 lbs lost per week (maximum recommended)
5. Be encouraging but realistic about timelines
6. Round calories to nearest 50 for simplicity

ESTIMATION METHOD:
1. Estimate BMR using Mifflin-St Jeor (assume average height, moderate activity)
2. For lbs: assume sedentary TDEE multiplier of 1.4
3. Calculate deficit needed for ~1 lb/week loss (moderate, sustainable pace)
4. Ensure final number is at least 1400 calories`;

export async function optimizeCaloriesWithAI(
	currentWeight: number,
	goalWeight: number,
	unit: string
): Promise<CalorieOptimization> {
	const weightDiff = currentWeight - goalWeight;
	const isLosing = weightDiff > 0;

	const prompt = `Current weight: ${currentWeight} ${unit}
Goal weight: ${goalWeight} ${unit}
Weight to ${isLosing ? 'lose' : 'gain'}: ${Math.abs(weightDiff).toFixed(1)} ${unit}

Calculate the optimal daily calorie target for ${isLosing ? 'safe, sustainable weight loss' : 'healthy weight gain'}.
Provide a realistic timeline and brief explanation.`;

	const { object } = await generateObject({
		model: openrouter.chat('google/gemini-2.5-flash-preview-09-2025'),
		schema: calorieOptimizationSchema,
		messages: [
			{ role: 'system', content: CALORIE_SYSTEM_PROMPT },
			{ role: 'user', content: prompt }
		]
	});

	return object;
}
