<script lang="ts">
	import NutritionSummary from '$lib/components/nutrition-summary.svelte';
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
		getFrequentMeals,
		getImageUploadUrl
	} from '$lib/remote/meals.remote';
	import type { MealInput } from '$lib/types';
	import AlignLeftIcon from '@lucide/svelte/icons/align-left';
	import ScanIcon from '@lucide/svelte/icons/scan';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import EditIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ScanLineIcon from '@lucide/svelte/icons/scan-line';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import TagIcon from '@lucide/svelte/icons/tag';
	import UtensilsIcon from '@lucide/svelte/icons/utensils';
	import XIcon from '@lucide/svelte/icons/x';
	import { toast } from 'svelte-sonner';
	import ResponsiveDialog from './dialog-responsive.svelte';

	let {
		open = $bindable(false),
		onAdd
	}: {
		open?: boolean;
		onAdd?: (meal: MealInput) => void;
	} = $props();

	let view = $state<'select' | 'camera' | 'describe' | 'manual'>('select');

	const initialFrequentMeals = await getFrequentMeals();
	const frequentMeals = $derived(getFrequentMeals().current ?? initialFrequentMeals);

	function handleQuickLog(meal: (typeof frequentMeals)[0]) {
		onAdd?.({
			name: meal.name,
			servings: 1,
			calories: meal.calories,
			protein: meal.protein ?? undefined,
			carbs: meal.carbs ?? undefined,
			fat: meal.fat ?? undefined
		});
		open = false;
	}

	let name = $state('');
	let description = $state('');
	let imagePreview = $state<string | null>(null);
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

	const title = $derived(
		view === 'select'
			? 'Log Meal'
			: view === 'camera'
				? 'Scan Photo'
				: view === 'describe'
					? 'Describe Meal'
					: 'Manual Entry'
	);

	function resetForm() {
		name = '';
		description = '';
		amountEaten = '1';
		baseCalories = 0;
		baseProtein = 0;
		baseCarbs = 0;
		baseFat = 0;
		imagePreview = null;
		analyzing = false;
		analyzed = false;
		isNutritionLabel = false;
		servingSize = null;
		servingQuantity = null;
		servingUnit = null;
	}

	function reset() {
		resetForm();
		view = 'select';
	}

	function goToSelect() {
		resetForm();
		view = 'select';
	}

	function selectMode(mode: 'camera' | 'describe' | 'manual') {
		view = mode;
		if (mode === 'manual') {
			setTimeout(() => {
				const el = document.getElementById('name');
				el?.focus();
			}, 50);
		}
	}

	$effect(() => {
		if (!open) {
			reset();
		}
	});

	const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

	async function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || !target.files[0]) return;

		const file = target.files[0];

		if (file.size > MAX_FILE_SIZE) {
			toast.error('Image is too large. Please use an image under 15MB.');
			return;
		}

		const mimeType = file.type || 'image/jpeg';

		imagePreview = URL.createObjectURL(file);
		analyzing = true;
		analyzed = false;

		try {
			const { imageKey, uploadUrl } = await getImageUploadUrl({ mimeType });

			const uploadResponse = await fetch(uploadUrl, {
				method: 'PUT',
				body: file,
				headers: { 'Content-Type': mimeType }
			});

			if (!uploadResponse.ok) {
				throw new Error('Failed to upload image');
			}

			const result = await analyzeMealImage({ imageKey, mimeType });

			name = result.name;
			baseCalories = result.calories;
			baseProtein = result.protein;
			baseCarbs = result.carbs;
			baseFat = result.fat;
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

	function clearImage() {
		imagePreview = null;
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
			fat: fat || undefined
		});

		open = false;
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
</script>

<ResponsiveDialog
	bind:open
	{title}
	subtitle={view === 'select' ? 'Log a meal or pick from recent' : undefined}
	onBack={view !== 'select' ? goToSelect : undefined}
	contentClass="sm:max-w-md"
>
	{#snippet icon()}
		<UtensilsIcon class="size-5 text-muted-foreground" />
	{/snippet}

	<div class="py-4">
		{#if view === 'select'}
			<div class="space-y-4">
				{#if frequentMeals.length > 0}
					<div class="space-y-2">
						<div
							class="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider"
						>
							<HistoryIcon class="size-3" />
							Quick Log
						</div>
						<div class="space-y-1.5">
							{#each frequentMeals as meal (meal.id)}
								<button
									type="button"
									class="w-full flex items-center gap-3 rounded-lg border bg-card p-2.5 text-left transition-all hover:border-primary/30 hover:bg-muted/50 group"
									onclick={() => handleQuickLog(meal)}
								>
									<div class="flex-1 min-w-0">
										<p class="font-medium text-sm truncate">{meal.name}</p>
										<p class="text-xs text-muted-foreground">
											{meal.calories} kcal{#if meal.protein}&nbsp;· {meal.protein}g protein{/if}
										</p>
									</div>
									<div
										class="shrink-0 size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary opacity-0 group-hover:opacity-100 transition-opacity"
									>
										<PlusIcon class="size-4" />
									</div>
								</button>
							{/each}
						</div>
						<div class="relative py-3">
							<div class="absolute inset-0 flex items-center">
								<div class="w-full border-t border-border"></div>
							</div>
							<div class="relative flex justify-center">
								<span class="bg-background px-2 text-xs text-muted-foreground">or add new</span>
							</div>
						</div>
					</div>
				{/if}

				<div class="space-y-2">
					<button
						type="button"
						class="w-full flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-all hover:border-primary/30 hover:bg-muted/50"
						onclick={() => selectMode('camera')}
					>
						<div class="rounded-lg bg-muted p-2">
							<ScanIcon class="size-5 text-muted-foreground" />
						</div>
						<div class="flex-1">
							<p class="font-medium">Scan a photo</p>
							<p class="text-xs text-muted-foreground">Food or nutrition label</p>
						</div>
						<ChevronRightIcon class="size-5 text-muted-foreground" />
					</button>

					<button
						type="button"
						class="w-full flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-all hover:border-primary/30 hover:bg-muted/50"
						onclick={() => selectMode('describe')}
					>
						<div class="rounded-lg bg-muted p-2">
							<AlignLeftIcon class="size-5 text-muted-foreground" />
						</div>
						<div class="flex-1">
							<p class="font-medium">Describe your meal</p>
							<p class="text-xs text-muted-foreground">AI estimates from text</p>
						</div>
						<ChevronRightIcon class="size-5 text-muted-foreground" />
					</button>

					<button
						type="button"
						class="w-full flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-all hover:border-primary/30 hover:bg-muted/50"
						onclick={() => selectMode('manual')}
					>
						<div class="rounded-lg bg-muted p-2">
							<EditIcon class="size-5 text-muted-foreground" />
						</div>
						<div class="flex-1">
							<p class="font-medium">Enter manually</p>
							<p class="text-xs text-muted-foreground">Type in calories and macros</p>
						</div>
						<ChevronRightIcon class="size-5 text-muted-foreground" />
					</button>
				</div>
			</div>
		{:else}
			<div class="space-y-6">
				{#if view === 'camera'}
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
				{:else if view === 'describe'}
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
							<NutritionSummary
								{calories}
								{protein}
								{carbs}
								{fat}
								label="Your total"
								servingsLabel="{servings.toFixed(1)} serving{servings !== 1 ? 's' : ''}"
								size="lg"
								alwaysShowMacros
							/>
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
							<NutritionSummary
								{calories}
								{protein}
								{carbs}
								{fat}
								label="Total for {amountEaten} servings"
							/>
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
		{/if}
	</div>
</ResponsiveDialog>
