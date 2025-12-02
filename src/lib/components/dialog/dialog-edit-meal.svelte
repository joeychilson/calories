<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import { Label } from '$lib/components/ui/label';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ResponsiveDialog from './dialog-responsive.svelte';

	type MealData = {
		id: string;
		name: string;
		calories: number;
		servings?: number;
		protein?: number;
		carbs?: number;
		fat?: number;
	};

	let {
		open = $bindable(false),
		meal,
		onSave
	}: {
		open?: boolean;
		meal: MealData | null;
		onSave?: (meal: MealData) => void;
	} = $props();

	let name = $state('');
	let servings = $state('1');

	// Base values (per serving)
	let baseCalories = $state(0);
	let baseProtein = $state(0);
	let baseCarbs = $state(0);
	let baseFat = $state(0);

	// Track original servings to calculate base values
	let originalServings = $state(1);

	// Calculated totals
	let servingsNum = $derived(parseFloat(servings) || 1);
	let calories = $derived(Math.round(baseCalories * servingsNum));
	let protein = $derived(Math.round(baseProtein * servingsNum));
	let carbs = $derived(Math.round(baseCarbs * servingsNum));
	let fat = $derived(Math.round(baseFat * servingsNum));

	$effect(() => {
		if (open && meal) {
			name = meal.name;
			originalServings = meal.servings || 1;
			servings = String(originalServings);

			// Calculate base values (per serving) from the stored totals
			baseCalories = Math.round(meal.calories / originalServings);
			baseProtein = meal.protein ? Math.round(meal.protein / originalServings) : 0;
			baseCarbs = meal.carbs ? Math.round(meal.carbs / originalServings) : 0;
			baseFat = meal.fat ? Math.round(meal.fat / originalServings) : 0;
		}
	});

	function handleSubmit() {
		if (!name || calories <= 0 || !meal) return;

		onSave?.({
			id: meal.id,
			name,
			servings: servingsNum,
			calories,
			protein: protein || undefined,
			carbs: carbs || undefined,
			fat: fat || undefined
		});

		open = false;
	}

	function handleBaseCaloriesInput(value: string) {
		baseCalories = parseInt(value) || 0;
	}

	function handleBaseProteinInput(value: string) {
		baseProtein = parseInt(value) || 0;
	}

	function handleBaseCarbsInput(value: string) {
		baseCarbs = parseInt(value) || 0;
	}

	function handleBaseFatInput(value: string) {
		baseFat = parseInt(value) || 0;
	}
</script>

<ResponsiveDialog
	bind:open
	title="Edit Meal"
	subtitle="Update your meal details."
	contentClass="sm:max-w-md"
>
	<div class="space-y-6 py-4">
		<!-- Form Fields -->
		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="edit-name">Meal Name</Label>
				<InputGroup.Root>
					<InputGroup.Input
						id="edit-name"
						type="text"
						placeholder="e.g., Grilled Chicken Salad"
						bind:value={name}
					/>
				</InputGroup.Root>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="edit-calories"
						>Calories <span class="text-muted-foreground text-xs font-normal">(per serving)</span
						></Label
					>
					<InputGroup.Root>
						<InputGroup.Input
							id="edit-calories"
							type="number"
							inputmode="numeric"
							placeholder="0"
							value={baseCalories || ''}
							oninput={(e) => handleBaseCaloriesInput(e.currentTarget.value)}
						/>
						<InputGroup.Addon>
							<InputGroup.Text>kcal</InputGroup.Text>
						</InputGroup.Addon>
					</InputGroup.Root>
				</div>

				<div class="space-y-2">
					<Label for="edit-servings">Servings</Label>
					<InputGroup.Root>
						<InputGroup.Input
							id="edit-servings"
							type="number"
							inputmode="decimal"
							step="0.5"
							min="0"
							placeholder="1"
							bind:value={servings}
						/>
					</InputGroup.Root>
				</div>
			</div>

			<!-- Macros -->
			<div class="grid grid-cols-3 gap-3">
				<div class="space-y-2">
					<Label for="edit-protein" class="text-xs text-muted-foreground">Protein</Label>
					<InputGroup.Root>
						<InputGroup.Input
							id="edit-protein"
							type="number"
							inputmode="numeric"
							placeholder="0"
							value={baseProtein || ''}
							oninput={(e) => handleBaseProteinInput(e.currentTarget.value)}
							class="text-center"
						/>
						<InputGroup.Addon>
							<InputGroup.Text class="px-2">g</InputGroup.Text>
						</InputGroup.Addon>
					</InputGroup.Root>
				</div>
				<div class="space-y-2">
					<Label for="edit-carbs" class="text-xs text-muted-foreground">Carbs</Label>
					<InputGroup.Root>
						<InputGroup.Input
							id="edit-carbs"
							type="number"
							inputmode="numeric"
							placeholder="0"
							value={baseCarbs || ''}
							oninput={(e) => handleBaseCarbsInput(e.currentTarget.value)}
							class="text-center"
						/>
						<InputGroup.Addon>
							<InputGroup.Text class="px-2">g</InputGroup.Text>
						</InputGroup.Addon>
					</InputGroup.Root>
				</div>
				<div class="space-y-2">
					<Label for="edit-fat" class="text-xs text-muted-foreground">Fat</Label>
					<InputGroup.Root>
						<InputGroup.Input
							id="edit-fat"
							type="number"
							inputmode="numeric"
							placeholder="0"
							value={baseFat || ''}
							oninput={(e) => handleBaseFatInput(e.currentTarget.value)}
							class="text-center"
						/>
						<InputGroup.Addon>
							<InputGroup.Text class="px-2">g</InputGroup.Text>
						</InputGroup.Addon>
					</InputGroup.Root>
				</div>
			</div>

			<!-- Show calculated totals when servings != 1 -->
			{#if servingsNum !== 1 && baseCalories > 0}
				<div class="rounded-xl bg-muted/30 p-4">
					<div class="flex items-center justify-between mb-2">
						<span class="text-sm font-medium text-muted-foreground"
							>Total for {servings} serving{servingsNum !== 1 ? 's' : ''}</span
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
		</div>

		<!-- Submit Button -->
		<Button
			onclick={handleSubmit}
			disabled={!name || calories <= 0}
			class="w-full text-base font-bold"
		>
			<CheckIcon class="mr-2 size-5" />
			Save Changes
		</Button>
	</div>
</ResponsiveDialog>
