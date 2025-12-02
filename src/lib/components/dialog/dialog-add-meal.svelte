<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import { Label } from '$lib/components/ui/label';
	import { analyzeMealImage } from '$lib/remote/meals.remote';
	import CameraIcon from '@lucide/svelte/icons/camera';
	import CheckIcon from '@lucide/svelte/icons/check';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
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
		sodium?: number;
		cholesterol?: number;
		fiber?: number;
		sugar?: number;
		imageKey?: string;
	};

	let {
		open = $bindable(false),
		onAdd
	}: {
		open?: boolean;
		onAdd?: (meal: MealData) => void;
	} = $props();

	let name = $state('');
	let imagePreview = $state<string | null>(null);
	let imageKey = $state<string | null>(null);
	let analyzing = $state(false);
	let analyzed = $state(false);
	let fileInput: HTMLInputElement;

	// Serving size info from nutrition labels
	let isNutritionLabel = $state(false);
	let servingSize = $state<string | null>(null);
	let servingQuantity = $state<number | null>(null);
	let servingUnit = $state<string | null>(null);

	// Per-serving values (base values from AI)
	let baseCalories = $state(0);
	let baseProtein = $state(0);
	let baseCarbs = $state(0);
	let baseFat = $state(0);

	// User input - amount they ate in the serving unit
	let amountEaten = $state('1');

	// Calculate servings from amount eaten
	let servings = $derived.by(() => {
		const amount = parseFloat(amountEaten) || 0;
		if (!isNutritionLabel || !servingQuantity) {
			return amount;
		}
		return amount / servingQuantity;
	});

	// Calculate final values based on servings
	let calories = $derived(Math.round(baseCalories * servings));
	let protein = $derived(Math.round(baseProtein * servings));
	let carbs = $derived(Math.round(baseCarbs * servings));
	let fat = $derived(Math.round(baseFat * servings));

	function reset() {
		name = '';
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
	}

	function fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result as string;
				resolve(result);
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	async function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || !target.files[0]) return;

		const file = target.files[0];

		imagePreview = URL.createObjectURL(file);
		analyzing = true;
		analyzed = false;

		try {
			const base64 = await fileToBase64(file);
			const mimeType = file.type || 'image/jpeg';

			const result = await analyzeMealImage({
				imageData: base64,
				mimeType,
				fileName: file.name
			});

			name = result.name;
			baseCalories = result.calories;
			baseProtein = result.protein;
			baseCarbs = result.carbs;
			baseFat = result.fat;
			imageKey = result.imageKey;
			analyzed = true;

			// Handle nutrition label detection
			isNutritionLabel = result.isNutritionLabel ?? false;
			servingSize = result.servingSize ?? null;
			servingQuantity = result.servingQuantity ?? null;
			servingUnit = result.servingUnit ?? null;

			// Set initial amount based on whether it's a label
			if (isNutritionLabel && servingQuantity) {
				amountEaten = String(servingQuantity);
			} else {
				amountEaten = '1';
			}

			toast.success(isNutritionLabel ? 'Label scanned!' : 'Meal analyzed!', {
				description: `${result.name} - ${result.calories} kcal${servingSize ? ` per ${servingSize}` : ''}`
			});
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

	function clearImage() {
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
		reset();
	}

	function setQuickAmount(multiplier: number) {
		if (isNutritionLabel && servingQuantity) {
			amountEaten = String(servingQuantity * multiplier);
		} else {
			amountEaten = String(multiplier);
		}
	}

	// For manual entry mode (non-label)
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
</script>

<ResponsiveDialog
	bind:open
	title="Log Meal"
	subtitle="Snap a photo for instant AI analysis."
	contentClass="sm:max-w-md"
>
	<div class="space-y-6 py-4">
		<!-- Image Upload Area -->
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
						<CameraIcon class="size-6 text-muted-foreground" />
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

		<!-- Form Fields -->
		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="name">Meal Name</Label>
				<InputGroup.Root>
					<InputGroup.Input
						id="name"
						type="text"
						placeholder="e.g., Grilled Chicken Salad"
						bind:value={name}
					/>
				</InputGroup.Root>
			</div>

			<!-- Serving Size Input - Different UX for labels vs food photos -->
			{#if isNutritionLabel && servingSize && servingUnit}
				<!-- Nutrition Label Mode: Input amount in the serving unit -->
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<Label for="amount">How much did you eat?</Label>
						<span class="text-xs text-muted-foreground">
							Label: {servingSize} per serving
						</span>
					</div>
					<InputGroup.Root>
						<InputGroup.Input
							id="amount"
							type="number"
							inputmode="decimal"
							step="any"
							min="0"
							placeholder={String(servingQuantity ?? 1)}
							bind:value={amountEaten}
							class="text-lg font-semibold"
						/>
						<InputGroup.Addon>
							<InputGroup.Text class="font-medium">{servingUnit}</InputGroup.Text>
						</InputGroup.Addon>
					</InputGroup.Root>

					<!-- Quick amount buttons -->
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

					<!-- Calculated totals display -->
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
				<!-- Food Photo / Manual Entry Mode -->
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="calories">Calories</Label>
						<InputGroup.Root>
							<InputGroup.Input
								id="calories"
								type="number"
								inputmode="numeric"
								placeholder="0"
								value={baseCalories || ''}
								oninput={(e) => handleManualCaloriesInput(e.currentTarget.value)}
							/>
							<InputGroup.Addon>
								<InputGroup.Text>kcal</InputGroup.Text>
							</InputGroup.Addon>
						</InputGroup.Root>
					</div>

					<div class="space-y-2">
						<Label for="servings">Servings</Label>
						<InputGroup.Root>
							<InputGroup.Input
								id="servings"
								type="number"
								inputmode="decimal"
								step="0.5"
								min="0"
								placeholder="1"
								bind:value={amountEaten}
							/>
						</InputGroup.Root>
					</div>
				</div>

				<!-- Macros -->
				<div class="grid grid-cols-3 gap-3">
					<div class="space-y-2">
						<Label for="protein" class="text-xs text-muted-foreground">Protein</Label>
						<InputGroup.Root>
							<InputGroup.Input
								id="protein"
								type="number"
								inputmode="numeric"
								placeholder="0"
								value={baseProtein || ''}
								oninput={(e) => handleManualProteinInput(e.currentTarget.value)}
								class="text-center"
							/>
							<InputGroup.Addon>
								<InputGroup.Text class="px-2">g</InputGroup.Text>
							</InputGroup.Addon>
						</InputGroup.Root>
					</div>
					<div class="space-y-2">
						<Label for="carbs" class="text-xs text-muted-foreground">Carbs</Label>
						<InputGroup.Root>
							<InputGroup.Input
								id="carbs"
								type="number"
								inputmode="numeric"
								placeholder="0"
								value={baseCarbs || ''}
								oninput={(e) => handleManualCarbsInput(e.currentTarget.value)}
								class="text-center"
							/>
							<InputGroup.Addon>
								<InputGroup.Text class="px-2">g</InputGroup.Text>
							</InputGroup.Addon>
						</InputGroup.Root>
					</div>
					<div class="space-y-2">
						<Label for="fat" class="text-xs text-muted-foreground">Fat</Label>
						<InputGroup.Root>
							<InputGroup.Input
								id="fat"
								type="number"
								inputmode="numeric"
								placeholder="0"
								value={baseFat || ''}
								oninput={(e) => handleManualFatInput(e.currentTarget.value)}
								class="text-center"
							/>
							<InputGroup.Addon>
								<InputGroup.Text class="px-2">g</InputGroup.Text>
							</InputGroup.Addon>
						</InputGroup.Root>
					</div>
				</div>

				<!-- Show calculated totals when servings > 1 in manual mode -->
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

		<!-- Submit Button -->
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
