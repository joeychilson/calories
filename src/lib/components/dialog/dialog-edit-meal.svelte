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
	let calories = $state('');
	let protein = $state('');
	let carbs = $state('');
	let fat = $state('');

	$effect(() => {
		if (open && meal) {
			name = meal.name;
			calories = String(meal.calories);
			protein = meal.protein ? String(meal.protein) : '';
			carbs = meal.carbs ? String(meal.carbs) : '';
			fat = meal.fat ? String(meal.fat) : '';
		}
	});

	function handleSubmit() {
		if (!name || !calories || !meal) return;

		onSave?.({
			id: meal.id,
			name,
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
