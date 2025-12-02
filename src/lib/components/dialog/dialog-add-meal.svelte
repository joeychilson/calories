<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		InputGroup,
		InputGroupAddon,
		InputGroupInput,
		InputGroupText
	} from '$lib/components/ui/input-group';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		analyzeMealImage,
		analyzeMealText,
		deleteUploadedImage,
		getImageUploadUrl
	} from '$lib/remote/meals.remote';
	import AlignLeftIcon from '@lucide/svelte/icons/align-left';
	import CameraIcon from '@lucide/svelte/icons/camera';
	import CheckIcon from '@lucide/svelte/icons/check';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import EditIcon from '@lucide/svelte/icons/pencil';
	import ScanLineIcon from '@lucide/svelte/icons/scan-line';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import TagIcon from '@lucide/svelte/icons/tag';
	import XIcon from '@lucide/svelte/icons/x';
	import { toast } from 'svelte-sonner';
	import ResponsiveDialog from './dialog-responsive.svelte';

	type MealData = {
		name: string;
		calories: number;
		servings?: number;
		protein?: number;
		carbs?: number;
		fat?: number;
		imageKey?: string;
	};

	let {
		open = $bindable(false),
		onAdd
	}: {
		open?: boolean;
		onAdd?: (meal: MealData) => void;
	} = $props();

	let mode = $state<'camera' | 'describe' | 'manual'>('camera');
	let name = $state('');
	let description = $state('');
	let imagePreview = $state<string | null>(null);
	let imageKey = $state<string | null>(null);
	let analyzing = $state(false);
	let analyzed = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);

	let isNutritionLabel = $state(false);
	let servingSize = $state<string | null>(null);
	let servingQuantity = $state<number | null>(null);
	let servingUnit = $state<string | null>(null);

	let baseCalories = $state(0);
	let baseProtein = $state(0);
	let baseCarbs = $state(0);
	let baseFat = $state(0);
	let amountEaten = $state('1');

	let servings = $derived.by(() => {
		const amount = parseFloat(amountEaten) || 0;
		if (!isNutritionLabel || !servingQuantity) {
			return amount;
		}
		return amount / servingQuantity;
	});

	let calories = $derived(Math.round(baseCalories * servings));
	let protein = $derived(Math.round(baseProtein * servings));
	let carbs = $derived(Math.round(baseCarbs * servings));
	let fat = $derived(Math.round(baseFat * servings));

	function reset(deleteImage = false) {
		if (deleteImage && imageKey) {
			deleteUploadedImage({ imageKey }).catch(() => {});
		}
		name = '';
		description = '';
		amountEaten = '1';
		baseCalories = 0;
		baseProtein = 0;
		baseCarbs = 0;
		baseFat = 0;
		imagePreview = null;
		imageKey = null;
		analyzing = false;
		analyzed = false;
		isNutritionLabel = false;
		servingSize = null;
		servingQuantity = null;
		servingUnit = null;
		mode = 'camera';
	}

	let wasOpen = $state(false);

	$effect(() => {
		if (wasOpen && !open) {
			reset(true);
		}
		wasOpen = open;
	});

	async function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || !target.files[0]) return;

		const file = target.files[0];
		const mimeType = file.type || 'image/jpeg';

		imagePreview = URL.createObjectURL(file);
		analyzing = true;
		analyzed = false;

		try {
			const { imageKey: key, uploadUrl } = await getImageUploadUrl({ mimeType });

			const uploadResponse = await fetch(uploadUrl, {
				method: 'PUT',
				body: file,
				headers: { 'Content-Type': mimeType }
			});

			if (!uploadResponse.ok) {
				throw new Error('Failed to upload image');
			}

			imageKey = key;

			const result = await analyzeMealImage({ imageKey: key, mimeType });

			name = result.name;
			baseCalories = result.calories;
			baseProtein = result.protein;
			baseCarbs = result.carbs;
			baseFat = result.fat;
			imageKey = result.imageKey;
			analyzed = true;
			isNutritionLabel = result.isNutritionLabel ?? false;
			servingSize = result.servingSize ?? null;
			servingQuantity = result.servingQuantity ?? null;
			servingUnit = result.servingUnit ?? null;
			if (isNutritionLabel && servingQuantity) {
				amountEaten = String(servingQuantity);
			} else {
				amountEaten = '1';
			}
		} catch (err: unknown) {
			console.error('Analysis failed', err);
			const message = err instanceof Error ? err.message : 'Failed to analyze meal';
			toast.error(message);
			imagePreview = null;
			imageKey = null;
		} finally {
			analyzing = false;
		}
	}

	async function handleTextAnalyze() {
		if (!description.trim()) return;

		analyzing = true;
		analyzed = false;

		try {
			const result = await analyzeMealText({
				description: description
			});

			name = result.name;
			baseCalories = result.calories;
			baseProtein = result.protein;
			baseCarbs = result.carbs;
			baseFat = result.fat;
			analyzed = true;
			isNutritionLabel = false;
			amountEaten = '1';
		} catch (err: unknown) {
			console.error('Text analysis failed', err);
			const message = err instanceof Error ? err.message : 'Failed to analyze description';
			toast.error(message);
		} finally {
			analyzing = false;
		}
	}

	async function clearImage() {
		if (imageKey) {
			deleteUploadedImage({ imageKey }).catch(() => {});
		}
		imagePreview = null;
		imageKey = null;
		analyzed = false;
		isNutritionLabel = false;
		servingSize = null;
		servingQuantity = null;
		servingUnit = null;
		if (fileInput) fileInput.value = '';
	}

	function handleSubmit() {
		if (!name || calories <= 0) return;

		onAdd?.({
			name,
			servings: servings || 1,
			calories,
			protein: protein || undefined,
			carbs: carbs || undefined,
			fat: fat || undefined,
			imageKey: imageKey || undefined
		});

		open = false;
		reset(false);
	}

	function setQuickAmount(multiplier: number) {
		if (isNutritionLabel && servingQuantity) {
			amountEaten = String(servingQuantity * multiplier);
		} else {
			amountEaten = String(multiplier);
		}
	}

	function handleManualCaloriesInput(value: string) {
		baseCalories = parseInt(value) || 0;
		amountEaten = '1';
	}

	function handleManualProteinInput(value: string) {
		baseProtein = parseInt(value) || 0;
	}

	function handleManualCarbsInput(value: string) {
		baseCarbs = parseInt(value) || 0;
	}

	function handleManualFatInput(value: string) {
		baseFat = parseInt(value) || 0;
	}

	function setMode(newMode: 'camera' | 'describe' | 'manual') {
		mode = newMode;
		if (newMode === 'manual') {
			setTimeout(() => {
				const el = document.getElementById('name');
				el?.focus();
			}, 50);
		}
	}
</script>

<ResponsiveDialog
	bind:open
	title="Log Meal"
	subtitle="Scan a photo or describe your food for AI analysis."
	contentClass="sm:max-w-md"
>
	<div class="space-y-6 py-4">
		<div class="bg-muted/50 p-1 rounded-lg flex gap-1">
			<button
				type="button"
				class="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all {mode ===
				'camera'
					? 'bg-background shadow-sm text-foreground'
					: 'text-muted-foreground hover:bg-background/50 hover:text-foreground'}"
				onclick={() => setMode('camera')}
			>
				<CameraIcon class="size-4" />
				Scan
			</button>
			<button
				type="button"
				class="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all {mode ===
				'describe'
					? 'bg-background shadow-sm text-foreground'
					: 'text-muted-foreground hover:bg-background/50 hover:text-foreground'}"
				onclick={() => setMode('describe')}
			>
				<AlignLeftIcon class="size-4" />
				Describe
			</button>
			<button
				type="button"
				class="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all {mode ===
				'manual'
					? 'bg-background shadow-sm text-foreground'
					: 'text-muted-foreground hover:bg-background/50 hover:text-foreground'}"
				onclick={() => setMode('manual')}
			>
				<EditIcon class="size-4" />
				Manual
			</button>
		</div>
		{#if mode === 'camera'}
			<div class="relative">
				<button
					type="button"
					class="border-muted-foreground/20 hover:border-primary/50 bg-muted/20 hover:bg-muted/40 relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-all"
					onclick={() => fileInput?.click()}
					disabled={analyzing}
				>
					{#if imagePreview}
						<img src={imagePreview} alt="Preview" class="h-full w-full object-cover" />
						{#if analyzed}
							<div class="absolute top-3 left-3 flex items-center gap-2">
								{#if isNutritionLabel}
									<div
										class="bg-blue-500 text-white px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm"
									>
										<TagIcon class="size-3" />
										Label Scanned
									</div>
								{:else}
									<div
										class="bg-emerald-500 text-white px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm"
									>
										<SparklesIcon class="size-3" />
										AI Analyzed
									</div>
								{/if}
							</div>
						{/if}
					{:else}
						<div class="bg-background p-4 rounded-full shadow-sm mb-2">
							<ScanLineIcon class="size-6 text-muted-foreground" />
						</div>
						<p class="text-sm font-medium">Take a photo</p>
					{/if}
					{#if analyzing}
						<div
							class="bg-background/90 absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm"
						>
							<div class="relative">
								<Loader2Icon class="text-primary size-8 animate-spin" />
							</div>
							<p class="text-sm font-medium mt-3">Analyzing...</p>
						</div>
					{/if}
					<input
						type="file"
						accept="image/jpeg,image/png,image/webp,image/heic"
						capture="environment"
						bind:this={fileInput}
						onchange={handleFileSelect}
						class="hidden"
					/>
				</button>
				{#if imagePreview && !analyzing}
					<button
						type="button"
						class="absolute -top-2 -right-2 bg-background shadow-sm border p-1.5 rounded-full hover:bg-destructive hover:text-destructive-foreground transition-colors"
						onclick={clearImage}
					>
						<XIcon class="size-3" />
					</button>
				{/if}
			</div>
		{:else if mode === 'describe'}
			<div class="space-y-3">
				<Label for="description">What did you eat?</Label>
				<div class="relative">
					<Textarea
						id="description"
						placeholder="e.g., 3 beef tacos with salsa and guacamole..."
						bind:value={description}
						class="min-h-[120px] resize-none text-base"
						disabled={analyzing}
					/>
					{#if analyzing}
						<div
							class="absolute inset-0 bg-background/80 flex flex-col items-center justify-center backdrop-blur-[1px] rounded-md"
						>
							<Loader2Icon class="text-primary size-6 animate-spin" />
							<p class="text-xs font-medium mt-2">Thinking...</p>
						</div>
					{/if}
				</div>
				<Button
					variant="secondary"
					class="w-full"
					disabled={!description.trim() || analyzing}
					onclick={handleTextAnalyze}
				>
					<SparklesIcon class="size-4 mr-2" />
					Analyze with AI
				</Button>
			</div>
		{/if}
		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="name">Meal Name</Label>
				<InputGroup>
					<InputGroupInput
						id="name"
						type="text"
						placeholder="e.g., Grilled Chicken Salad"
						bind:value={name}
					/>
				</InputGroup>
			</div>
			{#if isNutritionLabel && servingSize && servingUnit}
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<Label for="amount">How much did you eat?</Label>
						<span class="text-xs text-muted-foreground">
							Label: {servingSize} per serving
						</span>
					</div>
					<InputGroup>
						<InputGroupInput
							id="amount"
							type="number"
							inputmode="decimal"
							step="any"
							min="0"
							placeholder={String(servingQuantity ?? 1)}
							bind:value={amountEaten}
							class="text-lg font-semibold"
						/>
						<InputGroupAddon>
							<InputGroupText class="font-medium">{servingUnit}</InputGroupText>
						</InputGroupAddon>
					</InputGroup>

					<div class="flex gap-2">
						<button
							type="button"
							class="flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
							onclick={() => setQuickAmount(0.5)}
						>
							½×
						</button>
						<button
							type="button"
							class="flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
							onclick={() => setQuickAmount(1)}
						>
							1×
						</button>
						<button
							type="button"
							class="flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
							onclick={() => setQuickAmount(1.5)}
						>
							1½×
						</button>
						<button
							type="button"
							class="flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
							onclick={() => setQuickAmount(2)}
						>
							2×
						</button>
					</div>
					<div class="rounded-xl bg-muted/30 p-4">
						<div class="flex items-center justify-between mb-3">
							<span class="text-sm font-medium text-muted-foreground">Your total</span>
							<span class="text-xs text-muted-foreground">
								{servings.toFixed(1)} serving{servings !== 1 ? 's' : ''}
							</span>
						</div>
						<div class="flex items-baseline gap-1">
							<span class="text-3xl font-bold tabular-nums">{calories}</span>
							<span class="text-sm font-medium text-muted-foreground">kcal</span>
						</div>
						<div class="mt-3 flex items-center gap-4 text-sm">
							<span class="text-blue-500 dark:text-blue-400 font-medium">{protein}g P</span>
							<span class="text-muted-foreground/40">•</span>
							<span class="text-amber-500 dark:text-amber-400 font-medium">{carbs}g C</span>
							<span class="text-muted-foreground/40">•</span>
							<span class="text-rose-500 dark:text-rose-400 font-medium">{fat}g F</span>
						</div>
					</div>
				</div>
			{:else}
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="calories">Calories</Label>
						<InputGroup>
							<InputGroupInput
								id="calories"
								type="number"
								inputmode="numeric"
								placeholder="0"
								value={baseCalories || ''}
								oninput={(e) => handleManualCaloriesInput(e.currentTarget.value)}
							/>
							<InputGroupAddon>
								<InputGroupText>kcal</InputGroupText>
							</InputGroupAddon>
						</InputGroup>
					</div>

					<div class="space-y-2">
						<Label for="servings">Servings</Label>
						<InputGroup>
							<InputGroupInput
								id="servings"
								type="number"
								inputmode="decimal"
								step="0.5"
								min="0"
								placeholder="1"
								bind:value={amountEaten}
							/>
						</InputGroup>
					</div>
				</div>

				<div class="grid grid-cols-3 gap-3">
					<div class="space-y-2">
						<Label for="protein" class="text-xs text-muted-foreground">Protein</Label>
						<InputGroup>
							<InputGroupInput
								id="protein"
								type="number"
								inputmode="numeric"
								placeholder="0"
								value={baseProtein || ''}
								oninput={(e) => handleManualProteinInput(e.currentTarget.value)}
								class="text-center"
							/>
							<InputGroupAddon>
								<InputGroupText class="px-2">g</InputGroupText>
							</InputGroupAddon>
						</InputGroup>
					</div>
					<div class="space-y-2">
						<Label for="carbs" class="text-xs text-muted-foreground">Carbs</Label>
						<InputGroup>
							<InputGroupInput
								id="carbs"
								type="number"
								inputmode="numeric"
								placeholder="0"
								value={baseCarbs || ''}
								oninput={(e) => handleManualCarbsInput(e.currentTarget.value)}
								class="text-center"
							/>
							<InputGroupAddon>
								<InputGroupText class="px-2">g</InputGroupText>
							</InputGroupAddon>
						</InputGroup>
					</div>
					<div class="space-y-2">
						<Label for="fat" class="text-xs text-muted-foreground">Fat</Label>
						<InputGroup>
							<InputGroupInput
								id="fat"
								type="number"
								inputmode="numeric"
								placeholder="0"
								value={baseFat || ''}
								oninput={(e) => handleManualFatInput(e.currentTarget.value)}
								class="text-center"
							/>
							<InputGroupAddon>
								<InputGroupText class="px-2">g</InputGroupText>
							</InputGroupAddon>
						</InputGroup>
					</div>
				</div>

				{#if parseFloat(amountEaten) > 1 && baseCalories > 0}
					<div class="rounded-xl bg-muted/30 p-4">
						<div class="flex items-center justify-between mb-2">
							<span class="text-sm font-medium text-muted-foreground"
								>Total for {amountEaten} servings</span
							>
						</div>
						<div class="flex items-baseline gap-1">
							<span class="text-2xl font-bold tabular-nums">{calories}</span>
							<span class="text-sm font-medium text-muted-foreground">kcal</span>
						</div>
						{#if protein > 0 || carbs > 0 || fat > 0}
							<div class="mt-2 flex items-center gap-3 text-sm">
								{#if protein > 0}
									<span class="text-blue-500 dark:text-blue-400 font-medium">{protein}g P</span>
								{/if}
								{#if carbs > 0}
									<span class="text-amber-500 dark:text-amber-400 font-medium">{carbs}g C</span>
								{/if}
								{#if fat > 0}
									<span class="text-rose-500 dark:text-rose-400 font-medium">{fat}g F</span>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>

		<Button
			onclick={handleSubmit}
			disabled={!name || calories <= 0 || analyzing}
			class="w-full text-base font-bold"
		>
			{#if analyzing}
				<Loader2Icon class="mr-2 size-5 animate-spin" />
				Analyzing...
			{:else}
				<CheckIcon class="mr-2 size-5" />
				Log Meal
			{/if}
		</Button>
	</div>
</ResponsiveDialog>
