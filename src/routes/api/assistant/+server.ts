import type { Message } from '$lib/messages';
import { db } from '$lib/server/db';
import { logger } from '$lib/server/logger';
import { openrouter } from '$lib/server/openrouter';
import {
	buildSystemPrompt,
	type AssistantContext,
	type FoodPreference,
	type PantryItem
} from '$lib/server/prompt';
import { aiLimiter } from '$lib/server/ratelimit';
import { foodPreferences, pantryItems, type PantryCategory } from '$lib/server/schema';
import { assistantTools } from '$lib/server/tools';
import { json } from '@sveltejs/kit';
import {
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
	smoothStream,
	stepCountIs,
	streamText
} from 'ai';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const contextSchema = z.object({
	calorieGoal: z.number().int().min(0).max(50000),
	caloriesConsumed: z.number().int().min(0).max(100000),
	proteinConsumed: z.number().int().min(0).max(10000),
	carbsConsumed: z.number().int().min(0).max(10000),
	fatConsumed: z.number().int().min(0).max(10000),
	waterGoal: z.number().int().min(0).max(100000),
	waterConsumed: z.number().int().min(0).max(100000),
	currentWeight: z.number().min(0).max(2000).nullable(),
	weightGoal: z.number().min(0).max(2000).nullable(),
	units: z.enum(['imperial', 'metric']),
	sex: z.enum(['male', 'female']).nullable(),
	activityLevel: z.string().max(50),
	timezone: z.string().max(100).optional()
});

export const POST: RequestHandler = async (event) => {
	const { locals, request } = event;
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (await aiLimiter.isLimited(event)) {
		return json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
	}

	const userId = locals.user.id;

	try {
		const body = await request.json();
		const { messages, context: rawContext } = body as {
			context: unknown;
			messages: Message[];
		};

		if (!rawContext) {
			return json({ error: 'Context is required' }, { status: 400 });
		}

		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return json({ error: 'Messages are required' }, { status: 400 });
		}

		const contextResult = contextSchema.safeParse(rawContext);
		if (!contextResult.success) {
			return json({ error: 'Invalid context data' }, { status: 400 });
		}
		const context = contextResult.data;

		const [userPreferences, userPantry] = await Promise.all([
			db.select().from(foodPreferences).where(eq(foodPreferences.userId, userId)),
			db.select().from(pantryItems).where(eq(pantryItems.userId, userId))
		]);

		const preferences: FoodPreference[] = userPreferences.map((p) => ({
			id: p.id,
			category: p.category as FoodPreference['category'],
			value: p.value,
			notes: p.notes
		}));

		const pantry: PantryItem[] = userPantry.map((p) => ({
			id: p.id,
			name: p.name,
			category: p.category as PantryCategory | null,
			quantity: p.quantity,
			unit: p.unit
		}));

		const fullContext: AssistantContext = {
			...context,
			preferences,
			pantry
		};

		const systemPrompt = buildSystemPrompt(fullContext);

		return createUIMessageStreamResponse({
			stream: createUIMessageStream<Message>({
				execute: async ({ writer }) => {
					const result = streamText({
						model: openrouter.chat('google/gemini-3-pro-preview'),
						providerOptions: {
							openrouter: { provider: { sort: 'latency' }, reasoning: { enabled: true } }
						},
						system: systemPrompt,
						messages: convertToModelMessages(messages),
						tools: assistantTools,
						experimental_context: { userId, timezone: context.timezone },
						experimental_transform: smoothStream({ chunking: 'word' }),
						stopWhen: stepCountIs(10)
					});

					result.consumeStream();

					writer.merge(result.toUIMessageStream());
				},
				onError: (err) => {
					logger.error('assistant_stream_error', {
						userId,
						error: err instanceof Error ? err.message : String(err)
					});
					return 'An unexpected error occurred. Please try again.';
				}
			})
		});
	} catch (err) {
		logger.error('assistant_request_failed', {
			userId,
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Failed to process request' }, { status: 500 });
	}
};
