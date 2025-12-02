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
	let calories = $state('');
	let protein = $state('');
	let carbs = $state('');
	let fat = $state('');

	$effect(() => {
		if (open && meal) {
			name = meal.name;
			servings = meal.servings ? String(meal.servings) : '1';
			calories = String(meal.calories);
			protein = meal.protein ? String(meal.protein) : '';
			carbs = meal.carbs ? String(meal.carbs) : '';
			fat = meal.fat ? String(meal.fat) : '';
		}
	});

	function handleServingsInput(e: Event & { currentTarget: HTMLInputElement }) {
		const newVal = e.currentTarget.value;
		const oldValNum = parseFloat(servings);
		const newValNum = parseFloat(newVal);

		// If we have valid numbers for both and they are different
		if (
			!isNaN(oldValNum) &&
			!isNaN(newValNum) &&
			oldValNum > 0 &&
			newValNum > 0 &&
			oldValNum !== newValNum
		) {
			const ratio = newValNum / oldValNum;

			if (calories) calories = String(Math.round(parseInt(calories) * ratio));
			if (protein) protein = String(Math.round(parseInt(protein) * ratio));
			if (carbs) carbs = String(Math.round(parseInt(carbs) * ratio));
			if (fat) fat = String(Math.round(parseInt(fat) * ratio));
		}

		servings = newVal;
	}

	function handleSubmit() {
		if (!name || !calories || !meal) return;

		onSave?.({
			id: meal.id,
			name,
			servings: parseFloat(servings) || 1,
			calories: parseInt(calories),
			protein: protein ? parseInt(protein) : undefined,
			carbs: carbs ? parseInt(carbs) : undefined,
			fat: fat ? parseInt(fat) : undefined
		});

		open = false;
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
					<Label for="edit-calories">Calories</Label>
					<InputGroup.Root>
						<InputGroup.Input
							id="edit-calories"
							type="number"
							inputmode="numeric"
							placeholder="0"
							bind:value={calories}
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
							inputmode="numeric"
							step="0.5"
							min="0"
							placeholder="1"
							value={servings}
							oninput={handleServingsInput}
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
							bind:value={protein}
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
							bind:value={carbs}
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
							bind:value={fat}
							class="text-center"
						/>
						<InputGroup.Addon>
							<InputGroup.Text class="px-2">g</InputGroup.Text>
						</InputGroup.Addon>
					</InputGroup.Root>
				</div>
			</div>
		</div>

		<!-- Submit Button -->
		<Button onclick={handleSubmit} disabled={!name || !calories} class="w-full text-base font-bold">
			<CheckIcon class="mr-2 size-5" />
			Save Changes
		</Button>
	</div>
</ResponsiveDialog>
