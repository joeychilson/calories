<script lang="ts">
	import { Markdown } from '$lib/components/markdown';
	import {
		ToolDeleteMeal,
		ToolEditMeal,
		ToolLogWater,
		ToolLogWeight,
		ToolManagePantry,
		ToolManagePreference,
		ToolQueryMeals,
		ToolQueryPantry,
		ToolSuggestFood,
		ToolUpdateGoals,
		ToolWeightProgress
	} from '$lib/components/tool';
	import {
		InputGroup,
		InputGroupAddon,
		InputGroupButton,
		InputGroupText,
		InputGroupTextarea
	} from '$lib/components/ui/input-group';
	import type { Message, MessagePart } from '$lib/messages';
	import {
		addMeal,
		deleteUploadedImage,
		getImageUploadUrl,
		getMeals
	} from '$lib/remote/meals.remote';
	import { getPantryItems } from '$lib/remote/pantry.remote';
	import { getProfile } from '$lib/remote/profile.remote';
	import { getWaterForDate } from '$lib/remote/water.remote';
	import { getLatestWeight } from '$lib/remote/weight.remote';
	import type { MealInput } from '$lib/types';
	import { Chat } from '@ai-sdk/svelte';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ChefHatIcon from '@lucide/svelte/icons/chef-hat';
	import ImagePlusIcon from '@lucide/svelte/icons/image-plus';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import UtensilsIcon from '@lucide/svelte/icons/utensils';
	import XIcon from '@lucide/svelte/icons/x';
	import { DefaultChatTransport } from 'ai';
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import ResponsiveDialog from './dialog-responsive.svelte';

	let {
		open = $bindable(false),
		date
	}: {
		open?: boolean;
		date: string;
	} = $props();

	const initialMeals = await getMeals();
	const initialProfile = await getProfile();
	const initialLatestWeight = await getLatestWeight();

	const meals = $derived(getMeals().current ?? initialMeals);
	const profile = $derived(getProfile().current ?? initialProfile);
	const latestWeight = $derived(getLatestWeight().current ?? initialLatestWeight);
	const waterData = $derived(getWaterForDate(date).current);
	const currentDayMeals = $derived(meals.filter((m) => m.date === date));

	const context = $derived({
		calorieGoal: profile?.calorieGoal ?? 2000,
		caloriesConsumed: currentDayMeals.reduce((acc, m) => acc + m.calories, 0),
		proteinConsumed: currentDayMeals.reduce((acc, m) => acc + (m.protein || 0), 0),
		carbsConsumed: currentDayMeals.reduce((acc, m) => acc + (m.carbs || 0), 0),
		fatConsumed: currentDayMeals.reduce((acc, m) => acc + (m.fat || 0), 0),
		waterGoal: profile?.waterGoal ?? (profile?.units === 'imperial' ? 64 : 2000),
		waterConsumed: waterData?.amount ?? 0,
		currentWeight: latestWeight?.weight ?? null,
		weightGoal: profile?.weightGoal ?? null,
		units: profile?.units ?? 'imperial',
		sex: profile?.sex ?? null,
		activityLevel: profile?.activityLevel ?? 'moderate'
	});

	let imagePreview = $state<string | null>(null);
	let imageData = $state<{ imageKey: string; downloadUrl: string; mimeType: string } | null>(null);
	let currentImageKey = $state<string | null>(null);
	let uploadedImageKeys = $state<string[]>([]);
	let fileInput = $state<HTMLInputElement | null>(null);
	let messagesContainer = $state<HTMLDivElement | null>(null);
	let input = $state('');

	const chat = new Chat<Message>({
		id: 'food-assistant',
		transport: new DefaultChatTransport({
			api: '/api/assistant',
			body: () => ({
				context: { ...context, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
			})
		}),
		generateId: () => crypto.randomUUID(),
		onToolCall: async ({ toolCall }) => {
			const { toolName } = toolCall;
			if (['suggestFood', 'deleteMeal', 'editMeal'].includes(toolName)) {
				await getMeals().refresh();
			} else if (toolName === 'managePantryItem') {
				await getPantryItems().refresh();
			} else if (toolName === 'updateGoals') {
				await getProfile().refresh();
			} else if (toolName === 'logWeight') {
				await getLatestWeight().refresh();
			} else if (toolName === 'logWater') {
				await getWaterForDate(date).refresh();
			}
		},
		onError: () => toast.error('Something went wrong. Please try again.')
	});

	const isStreaming = $derived(chat.status === 'streaming' || chat.status === 'submitted');
	const remainingCalories = $derived(Math.max(0, context.calorieGoal - context.caloriesConsumed));
	const canSend = $derived((input.trim() || imageData) && !isStreaming);

	const toolTypes = new Set([
		'tool-suggestFood',
		'tool-managePreference',
		'tool-queryMealHistory',
		'tool-queryWeightHistory',
		'tool-updateGoals',
		'tool-logWeight',
		'tool-logWater',
		'tool-deleteMeal',
		'tool-editMeal',
		'tool-queryPantry',
		'tool-managePantryItem'
	]);

	const quickActions = [
		{
			icon: MenuIcon,
			label: 'Analyze menu',
			prompt: "Here's a menu - what should I order that fits my calorie budget?",
			needsImage: true
		},
		{
			icon: ChefHatIcon,
			label: 'What can I cook?',
			prompt: "Here's what I have - what can I make?",
			needsImage: true
		},
		{
			icon: UtensilsIcon,
			label: 'Suggest a meal',
			prompt: 'What should I eat right now that fits my remaining calories?',
			needsImage: false
		}
	];

	$effect(() => {
		if (!open) setTimeout(reset, 300);
	});

	$effect(() => {
		if (chat.messages.length > 0 && messagesContainer) {
			tick().then(() =>
				messagesContainer?.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' })
			);
		}
	});

	function hasRenderableContent(msg: Message): boolean {
		return msg.parts?.some((p) => (p.type === 'text' && p.text) || toolTypes.has(p.type)) ?? false;
	}

	function getMessageText(msg: Message): string {
		return (
			msg.parts
				?.filter((p) => p.type === 'text')
				.map((p) => p.text)
				.join('\n') || ''
		);
	}

	function reset() {
		[...uploadedImageKeys, currentImageKey]
			.filter(Boolean)
			.forEach((key) => deleteUploadedImage({ imageKey: key! }).catch(() => {}));
		imagePreview = imageData = currentImageKey = null;
		uploadedImageKeys = [];
		input = '';
		chat.messages = [];
	}

	const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

	async function handleFileSelect(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		if (file.size > MAX_FILE_SIZE) {
			toast.error('Image is too large. Please use an image under 15MB.');
			return;
		}

		imagePreview = URL.createObjectURL(file);
		try {
			const mimeType = file.type || 'image/jpeg';
			const { imageKey, uploadUrl, downloadUrl } = await getImageUploadUrl({ mimeType });
			const res = await fetch(uploadUrl, {
				method: 'PUT',
				body: file,
				headers: { 'Content-Type': mimeType }
			});
			if (!res.ok) throw new Error('Upload failed');
			currentImageKey = imageKey;
			imageData = { imageKey, downloadUrl, mimeType };
		} catch {
			toast.error('Failed to upload image');
			imagePreview = null;
		}
	}

	function clearImage() {
		if (currentImageKey) deleteUploadedImage({ imageKey: currentImageKey }).catch(() => {});
		imagePreview = imageData = currentImageKey = null;
		if (fileInput) fileInput.value = '';
	}

	async function handleSend(e?: Event) {
		e?.preventDefault();
		if (!canSend) return;

		const parts: MessagePart[] = [];
		if (imageData)
			parts.push({ type: 'file', url: imageData.downloadUrl, mediaType: imageData.mimeType });
		if (input.trim()) parts.push({ type: 'text', text: input.trim() });

		input = '';
		if (currentImageKey) {
			uploadedImageKeys = [...uploadedImageKeys, currentImageKey];
			imageData = imagePreview = currentImageKey = null;
		}

		await chat.sendMessage({ parts });
	}

	function handleQuickAction(action: (typeof quickActions)[number]) {
		if (action.needsImage) {
			fileInput?.click();
			input = action.prompt;
		} else {
			input = action.prompt;
			handleSend();
		}
	}

	async function handleLogMeal(meal: MealInput) {
		const [year, month, day] = date.split('-').map(Number);
		const now = new Date();
		const loggedAt = new Date(
			year,
			month - 1,
			day,
			now.getHours(),
			now.getMinutes(),
			now.getSeconds()
		).toISOString();

		try {
			await addMeal({ ...meal, servings: meal.servings ?? 1, date, loggedAt }).updates(getMeals());
		} catch {
			toast.error('Failed to log meal');
		}
	}
</script>

<ResponsiveDialog
	bind:open
	title="Food Assistant"
	subtitle="Ask me anything about food"
	contentClass="sm:max-w-lg h-[100dvh] sm:h-[600px] flex flex-col overflow-hidden"
	onBack={chat.messages.length > 0 ? reset : undefined}
>
	{#snippet icon()}
		<ChefHatIcon class="size-5 text-muted-foreground" />
	{/snippet}

	<div class="flex flex-1 flex-col overflow-hidden">
		<div
			bind:this={messagesContainer}
			class="flex-1 space-y-4 overflow-y-auto"
			style="scrollbar-width: thin;"
		>
			{#if chat.messages.length === 0 && !isStreaming}
				<div class="flex flex-col h-full">
					<div class="py-4 text-center">
						<p class="font-medium mb-1">What would you like help with?</p>
						<p class="text-sm text-muted-foreground">
							Upload a photo or ask me anything about food
						</p>
					</div>
					<div class="w-full space-y-2">
						{#each quickActions as action (action.label)}
							<button
								type="button"
								class="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:border-primary/30 hover:bg-muted/50"
								onclick={() => handleQuickAction(action)}
							>
								<div class="rounded-lg p-2 bg-muted">
									<action.icon class="size-4 text-muted-foreground" />
								</div>
								<span class="text-sm font-medium">{action.label}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			{#each chat.messages as message (message.id)}
				{#if message.role === 'user'}
					<div class="flex justify-end">
						<div class="max-w-[85%] space-y-2">
							{#each message.parts?.filter((p) => p.type === 'file') ?? [] as filePart, i (i)}
								<div class="flex justify-end">
									<div class="w-32 h-32 rounded-xl overflow-hidden border">
										<img src={filePart.url} alt="Uploaded" class="w-full h-full object-cover" />
									</div>
								</div>
							{/each}
							{#if getMessageText(message)}
								<div
									class="rounded-2xl rounded-br-md bg-primary px-4 py-2 text-primary-foreground shadow-xs"
								>
									<p class="whitespace-pre-wrap text-sm">{getMessageText(message)}</p>
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<div class="flex flex-col gap-2">
						{#if hasRenderableContent(message)}
							{#each message.parts as part, i (i)}
								{#if part.type === 'text' && part.text}
									<div class="my-1 rounded-xl bg-muted/50 px-3 py-2.5">
										<Markdown
											source={part.text}
											class="text-sm [&>p]:mb-2.5 [&>p:last-child]:mb-0 [&>ul]:my-2 [&>ol]:my-2 [&>li]:my-0.5"
										/>
									</div>
								{:else if part.type === 'tool-suggestFood' && part.state === 'input-available'}
									<ToolSuggestFood
										{...part.input}
										onLog={() => handleLogMeal(part.input as MealInput)}
									/>
								{:else if part.type === 'tool-managePreference' && (part.state === 'input-available' || part.state === 'output-available')}
									<ToolManagePreference
										input={part.input}
										output={part.state === 'output-available' ? part.output : undefined}
									/>
								{:else if part.type === 'tool-queryMealHistory' && part.state === 'output-available'}
									<ToolQueryMeals output={part.output} />
								{:else if part.type === 'tool-queryWeightHistory' && part.state === 'output-available'}
									<ToolWeightProgress output={part.output} />
								{:else if part.type === 'tool-updateGoals' && (part.state === 'input-available' || part.state === 'output-available')}
									<ToolUpdateGoals
										input={part.input}
										output={part.state === 'output-available' ? part.output : undefined}
									/>
								{:else if part.type === 'tool-logWeight' && part.state === 'output-available'}
									<ToolLogWeight output={part.output} />
								{:else if part.type === 'tool-logWater' && part.state === 'output-available'}
									<ToolLogWater output={part.output} />
								{:else if part.type === 'tool-deleteMeal' && part.state === 'output-available'}
									<ToolDeleteMeal output={part.output} />
								{:else if part.type === 'tool-editMeal' && part.state === 'output-available'}
									<ToolEditMeal output={part.output} />
								{:else if part.type === 'tool-queryPantry' && part.state === 'output-available'}
									<ToolQueryPantry output={part.output} />
								{:else if part.type === 'tool-managePantryItem' && (part.state === 'input-available' || part.state === 'output-available')}
									<ToolManagePantry
										input={part.input}
										output={part.state === 'output-available' ? part.output : undefined}
									/>
								{/if}
							{/each}
						{:else}
							<div class="flex items-center gap-2 px-1 py-2">
								<Loader2Icon class="size-4 animate-spin text-muted-foreground" />
								<span class="text-sm text-muted-foreground">Thinking...</span>
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>

		<div class="shrink-0 pt-3">
			<input
				type="file"
				accept="image/jpeg,image/png,image/webp"
				capture="environment"
				bind:this={fileInput}
				onchange={handleFileSelect}
				class="hidden"
			/>
			<form onsubmit={handleSend}>
				<InputGroup>
					<InputGroupTextarea
						bind:value={input}
						placeholder="Ask about food, menus, or what to cook..."
						class="min-h-[44px] max-h-[100px] resize-none"
						rows={1}
						onkeydown={(e) =>
							e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
						disabled={isStreaming}
					/>
					<InputGroupAddon align="block-end">
						{#if imagePreview}
							<div class="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border">
								<img src={imagePreview} alt="Attached" class="h-full w-full object-cover" />
								<button
									type="button"
									class="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow-sm"
									onclick={clearImage}
								>
									<XIcon class="size-3" />
								</button>
							</div>
						{:else}
							<InputGroupButton
								type="button"
								variant="outline"
								class="rounded-full"
								size="icon-xs"
								onclick={() => fileInput?.click()}
								disabled={isStreaming}
							>
								<ImagePlusIcon class="size-4" />
							</InputGroupButton>
						{/if}
						<InputGroupText class="ms-auto text-xs"
							>{remainingCalories.toLocaleString()} kcal left</InputGroupText
						>
						<InputGroupButton
							type="submit"
							variant="default"
							class="rounded-full"
							size="icon-xs"
							disabled={!canSend}
						>
							{#if isStreaming}
								<Loader2Icon class="size-4 animate-spin" />
							{:else}
								<ArrowUpIcon class="size-4" />
							{/if}
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			</form>
		</div>
	</div>
</ResponsiveDialog>
