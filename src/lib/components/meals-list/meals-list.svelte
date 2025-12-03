<script lang="ts">
	import { AddMealDialog, EditMealDialog } from '$lib/components/dialog';
	import { Button } from '$lib/components/ui/button';
	import { addMeal, deleteMeal, getMeals, updateMeal } from '$lib/remote/meals.remote';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import UtensilsIcon from '@lucide/svelte/icons/utensils';
	import { toast } from 'svelte-sonner';
	import MealItem from './meals-list-item.svelte';

	let { date }: { date: string } = $props();

	let isAddModalOpen = $state(false);
	let isEditModalOpen = $state(false);
	let editingMeal = $state<{
		id: string;
		name: string;
		calories: number;
		servings?: number;
		protein?: number;
		carbs?: number;
		fat?: number;
	} | null>(null);

	const initialMeals = await getMeals();
	const meals = $derived(getMeals().current ?? initialMeals);
	const currentDayMeals = $derived.by(() => {
		return meals.filter((m) => m.date === date).sort((a, b) => b.timestamp - a.timestamp);
	});

	type MealInput = {
		name: string;
		calories: number;
		servings?: number;
		protein?: number;
		carbs?: number;
		fat?: number;
		imageKey?: string;
	};

	async function handleAddMeal(meal: MealInput) {
		const now = new Date();
		const [year, month, day] = date.split('-').map(Number);
		const mealTime = new Date(
			year,
			month - 1,
			day,
			now.getHours(),
			now.getMinutes(),
			now.getSeconds()
		).toISOString();

		try {
			await addMeal({
				name: meal.name,
				calories: meal.calories,
				servings: meal.servings ?? 1,
				protein: meal.protein,
				carbs: meal.carbs,
				fat: meal.fat,
				imageKey: meal.imageKey,
				mealDate: date,
				mealTime
			}).updates(getMeals());
		} catch (err) {
			console.error('Failed to add meal:', err);
			toast.error('Failed to log meal');
		}
	}

	async function handleUpdateMeal(meal: {
		id: string;
		name: string;
		calories: number;
		servings?: number;
		protein?: number;
		carbs?: number;
		fat?: number;
	}) {
		try {
			await updateMeal({
				...meal,
				servings: meal.servings ?? 1
			}).updates(getMeals());
		} catch (err) {
			console.error('Failed to update meal:', err);
			toast.error('Failed to update meal');
		}
	}

	async function handleDeleteMeal(id: string) {
		try {
			await deleteMeal(id).updates(getMeals());
		} catch (err) {
			console.error('Failed to delete meal:', err);
			toast.error('Failed to delete meal');
		}
	}

	function handleEdit(meal: {
		id: string;
		name: string;
		calories: number;
		servings?: number;
		protein?: number | null;
		carbs?: number | null;
		fat?: number | null;
	}) {
		editingMeal = {
			id: meal.id,
			name: meal.name,
			calories: meal.calories,
			servings: meal.servings,
			protein: meal.protein ?? undefined,
			carbs: meal.carbs ?? undefined,
			fat: meal.fat ?? undefined
		};
		isEditModalOpen = true;
	}
</script>

<div class="flex min-h-0 flex-1 flex-col gap-2">
	<div class="flex shrink-0 items-center justify-between">
		<h2 class="flex items-center gap-2 text-lg font-bold">
			Meals
			<span class="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
				{currentDayMeals.length}
			</span>
		</h2>
		<Button size="sm" class="h-8 rounded-lg font-semibold" onclick={() => (isAddModalOpen = true)}>
			<PlusIcon class="size-4" />
			Log Meal
		</Button>
	</div>
	<div class="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">
		{#if currentDayMeals.length === 0}
			<div
				class="rounded-3xl border border-dashed border-muted bg-muted/10 py-12 text-center text-muted-foreground"
			>
				<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
					<UtensilsIcon class="size-6 opacity-50" />
				</div>
				<p class="font-medium">No meals logged yet</p>
				<p class="text-sm text-muted-foreground">Add your first meal to start tracking</p>
			</div>
		{:else}
			<div class="space-y-2 pb-4">
				{#each currentDayMeals as meal, i (meal.id)}
					<MealItem {meal} index={i} onEdit={handleEdit} onDelete={handleDeleteMeal} />
				{/each}
			</div>
		{/if}
	</div>
</div>

<AddMealDialog bind:open={isAddModalOpen} onAdd={handleAddMeal} />
<EditMealDialog bind:open={isEditModalOpen} meal={editingMeal} onSave={handleUpdateMeal} />
