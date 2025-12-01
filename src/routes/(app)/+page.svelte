<script lang="ts">
	import AddMealDialog from '$lib/components/dialog/dialog-add-meal.svelte';
	import DatePickerDialog from '$lib/components/dialog/dialog-date-picker.svelte';
	import LogWeightDialog from '$lib/components/dialog/dialog-log-weight.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { addMeal, deleteMeal, getMeals } from '$lib/remote/meals.remote';
	import { getLatestWeight, getSettings, logWeight } from '$lib/remote/weight.remote';
	import { formatDate, getDisplayDate } from '$lib/utils/format';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ScaleIcon from '@lucide/svelte/icons/scale';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import TrendingDownIcon from '@lucide/svelte/icons/trending-down';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import UtensilsIcon from '@lucide/svelte/icons/utensils';
	import { toast } from 'svelte-sonner';
	import { SvelteDate, SvelteMap } from 'svelte/reactivity';

	const selectedDate = new SvelteDate();
	let isAddModalOpen = $state(false);
	let isDatePickerOpen = $state(false);
	let isWeightModalOpen = $state(false);

	const meals = getMeals();
	const settings = getSettings();
	const latestWeight = getLatestWeight();

	let currentDayMeals = $derived.by(() => {
		if (!meals.current) return [];
		const dateStr = formatDate(selectedDate);
		return meals.current
			.filter((m) => m.date === dateStr)
			.sort((a, b) => b.timestamp - a.timestamp);
	});

	let totalCalories = $derived.by(() => {
		return currentDayMeals.reduce((acc, curr) => acc + curr.calories, 0);
	});

	let calorieGoal = $derived(settings.current?.calorieGoal ?? 2200);
	let weightGoal = $derived(settings.current?.weightGoal ?? null);
	let weightUnit = $derived(settings.current?.weightUnit ?? 'lbs');
	let currentWeight = $derived(latestWeight.current?.weight ?? null);

	let remainingCalories = $derived(calorieGoal - totalCalories);
	let isOver = $derived(totalCalories > calorieGoal);

	let history = $derived.by(() => {
		if (!meals.current) return [];
		const historyMap = new SvelteMap<string, number>();
		meals.current.forEach((m) => {
			const current = historyMap.get(m.date) || 0;
			historyMap.set(m.date, current + m.calories);
		});

		return Array.from(historyMap.entries()).map(([date, cals]) => ({
			date,
			status:
				cals > calorieGoal
					? 'over'
					: ((cals > calorieGoal * 0.8 ? 'met' : 'under') as 'over' | 'met' | 'under')
		}));
	});

	function handleDateChange(days: number) {
		selectedDate.setDate(selectedDate.getDate() + days);
	}

	type MealInput = {
		name: string;
		calories: number;
		protein?: number;
		carbs?: number;
		fat?: number;
		imageKey?: string;
		imageUrl?: string;
	};

	async function handleAddMeal(meal: MealInput) {
		try {
			await addMeal({
				name: meal.name,
				calories: meal.calories,
				protein: meal.protein,
				carbs: meal.carbs,
				fat: meal.fat,
				imageKey: meal.imageKey,
				mealTime: selectedDate.toISOString()
			}).updates(meals);

			toast.success('Meal logged!');
		} catch (err) {
			console.error('Failed to add meal:', err);
			toast.error('Failed to log meal');
		}
	}

	async function handleDeleteMeal(id: string) {
		try {
			await deleteMeal(id).updates(meals);
			toast.success('Meal deleted');
		} catch (err) {
			console.error('Failed to delete meal:', err);
			toast.error('Failed to delete meal');
		}
	}

	async function handleLogWeight(weight: number) {
		try {
			await logWeight({ weight }).updates(latestWeight);
			toast.success('Weight logged!');
		} catch (err) {
			console.error('Failed to log weight:', err);
			toast.error('Failed to log weight');
		}
	}
</script>

<div class="bg-muted/20 min-h-screen pb-32 font-sans pt-14">
	<header
		class="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-20 px-4 pt-4 pb-2 backdrop-blur-xl border-b border-border/5"
	>
		<div class="mx-auto flex max-w-md items-center justify-between relative">
			<Button
				variant="ghost"
				size="icon"
				class="rounded-full hover:bg-muted"
				onclick={() => handleDateChange(-1)}
			>
				<ChevronLeftIcon class="size-5 text-muted-foreground" />
			</Button>

			<button
				class="flex flex-col items-center cursor-pointer group rounded-xl px-4 py-1 hover:bg-muted/50 transition-all active:scale-95"
				onclick={() => (isDatePickerOpen = true)}
			>
				<span class="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
					{selectedDate.getFullYear()}
				</span>
				<span
					class="text-foreground flex items-center gap-2 text-lg font-bold group-hover:text-primary transition-colors"
				>
					<CalendarIcon class="text-primary size-4" />
					{getDisplayDate(selectedDate)}
				</span>
			</button>

			<Button
				variant="ghost"
				size="icon"
				class="rounded-full hover:bg-muted"
				onclick={() => handleDateChange(1)}
				disabled={formatDate(selectedDate) === formatDate(new Date())}
			>
				<ChevronRightIcon class="size-5 text-muted-foreground" />
			</Button>

			<div class="absolute right-0 top-1/2 -translate-y-1/2 hidden md:block">
				<!-- Desktop only settings placeholder if needed -->
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-md px-4 pt-6 space-y-8">
		<div class="animate-in fade-in zoom-in duration-500 space-y-6">
			<Card
				class="bg-background/50 border-none shadow-sm backdrop-blur-sm overflow-visible relative"
			>
				<CardContent class="p-6 pb-2">
					<div class="flex items-center justify-between mb-2">
						<div>
							<h3 class="text-sm font-medium text-muted-foreground">Calories</h3>
						</div>
						<div class="text-right">
							<div class="text-sm font-medium text-muted-foreground">Goal</div>
						</div>
					</div>

					<div class="flex items-end justify-between">
						<div>
							<span class="text-4xl font-bold tracking-tighter block leading-none"
								>{totalCalories}</span
							>
						</div>
						<div class="text-right">
							<span class="text-xl font-bold text-muted-foreground block leading-none"
								>{calorieGoal}</span
							>
						</div>
					</div>

					<div class="mt-4 h-3 w-full bg-muted/50 rounded-full overflow-hidden">
						<div
							class="h-full rounded-full transition-all duration-1000 ease-out {isOver
								? 'bg-destructive'
								: 'bg-primary'}"
							style="width: {Math.min((totalCalories / calorieGoal) * 100, 100)}%"
						></div>
					</div>

					<div class="mt-2 flex justify-between text-xs text-muted-foreground font-medium">
						<span>0</span>
						<span>{remainingCalories} left</span>
					</div>
				</CardContent>
			</Card>

			<div class="grid grid-cols-2 gap-4">
				<button
					class="bg-card hover:bg-accent/50 transition-colors rounded-2xl p-4 border shadow-sm text-left relative group"
					onclick={() => (isWeightModalOpen = true)}
				>
					<div class="flex items-center gap-2 mb-2">
						<ScaleIcon class="size-4 text-indigo-500" />
						<span class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
							>Weight</span
						>
					</div>
					{#if currentWeight}
						<div class="flex items-baseline gap-1">
							<span class="text-2xl font-bold tracking-tight">{currentWeight}</span>
							<span class="text-xs font-medium text-muted-foreground">{weightUnit}</span>
						</div>
						<div class="text-xs text-muted-foreground mt-1 flex items-center gap-1">
							{#if weightGoal && currentWeight > weightGoal}
								<TrendingDownIcon class="size-3 text-emerald-500" />
								<span class="text-emerald-500 font-medium"
									>{(currentWeight - weightGoal).toFixed(1)} to go</span
								>
							{:else if weightGoal}
								<TrendingUpIcon class="size-3 text-emerald-500" />
								<span class="text-emerald-500 font-medium">Goal Met!</span>
							{:else}
								<span class="text-muted-foreground">No goal set</span>
							{/if}
						</div>
					{:else}
						<p class="text-muted-foreground text-sm">Tap to log</p>
					{/if}
					<div class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
						<PlusIcon class="size-4 text-muted-foreground" />
					</div>
				</button>

				<div class="bg-card rounded-2xl p-4 border shadow-sm text-left">
					<div class="flex items-center gap-2 mb-2">
						<div class="size-4 rounded-full bg-orange-500/20 flex items-center justify-center">
							<div class="size-2 rounded-full bg-orange-500"></div>
						</div>
						<span class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
							>Streak</span
						>
					</div>
					<div class="flex items-baseline gap-1">
						<span class="text-2xl font-bold tracking-tight">12</span>
						<span class="text-xs font-medium text-muted-foreground">days</span>
					</div>
					<p class="text-xs text-muted-foreground mt-1">Keep it up!</p>
				</div>
			</div>
		</div>

		<div class="space-y-4">
			<div class="flex items-center justify-between px-1">
				<h2 class="text-foreground flex items-center gap-2 text-lg font-bold">
					Meals Today
					<span class="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-bold">
						{currentDayMeals.length}
					</span>
				</h2>
			</div>

			{#if meals.loading}
				<div class="flex justify-center py-12">
					<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
				</div>
			{:else if currentDayMeals.length === 0}
				<div
					class="bg-muted/30 border-dashed border-2 border-muted rounded-3xl py-16 flex flex-col items-center justify-center text-center"
				>
					<div class="bg-background p-4 rounded-full shadow-sm mb-4">
						<UtensilsIcon class="size-6 text-muted-foreground" />
					</div>
					<p class="text-muted-foreground font-medium">No meals logged yet.</p>
					<p class="text-xs text-muted-foreground/60 mt-1">Tap the + button to start.</p>
				</div>
			{:else}
				<div class="space-y-3 pb-4">
					{#each currentDayMeals as meal (meal.id)}
						<div
							class="bg-card hover:bg-accent/50 group relative overflow-hidden rounded-2xl border shadow-sm transition-all"
						>
							<div class="flex gap-4 p-3">
								<div class="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
									{#if meal.image}
										<img src={meal.image} alt={meal.name} class="h-full w-full object-cover" />
									{:else}
										<div
											class="text-muted-foreground flex h-full w-full items-center justify-center"
										>
											<UtensilsIcon class="size-5" />
										</div>
									{/if}
								</div>
								<div class="flex flex-1 flex-col justify-center gap-1 min-w-0">
									<div class="flex items-start justify-between gap-2">
										<h3 class="text-foreground truncate font-bold leading-tight">{meal.name}</h3>
										<span class="text-primary font-bold whitespace-nowrap"
											>{meal.calories} kcal</span
										>
									</div>

									{#if meal.protein || meal.carbs || meal.fat}
										<div class="flex gap-3 text-xs text-muted-foreground">
											{#if meal.protein}<span>{meal.protein}p</span>{/if}
											{#if meal.carbs}<span>{meal.carbs}c</span>{/if}
											{#if meal.fat}<span>{meal.fat}f</span>{/if}
										</div>
									{:else}
										<p class="text-muted-foreground text-xs">
											{new Date(meal.timestamp)
												.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
												.toLowerCase()}
										</p>
									{/if}
								</div>

								<button
									onclick={() => handleDeleteMeal(meal.id)}
									class="absolute inset-y-0 right-0 w-16 bg-linear-to-l from-background to-transparent flex items-center justify-end pr-3 opacity-0 group-hover:opacity-100 transition-opacity"
								>
									<div
										class="bg-destructive/10 hover:bg-destructive p-2 rounded-full text-destructive hover:text-white transition-colors"
									>
										<Trash2Icon class="size-4" />
									</div>
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</main>

	<div class="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-4">
		<Button
			size="lg"
			class="h-16 rounded-full px-8 shadow-xl shadow-primary/20 transition-transform hover:scale-105 active:scale-95 bg-primary text-primary-foreground"
			onclick={() => (isAddModalOpen = true)}
		>
			<PlusIcon class="mr-2 size-6 stroke-3" />
			<span class="text-lg font-bold">Log Meal</span>
		</Button>
	</div>

	<AddMealDialog bind:open={isAddModalOpen} onAdd={handleAddMeal} />
	<DatePickerDialog bind:open={isDatePickerOpen} date={selectedDate} {history} />
	<LogWeightDialog
		bind:open={isWeightModalOpen}
		onSave={handleLogWeight}
		currentWeight={currentWeight ?? 0}
		unit={weightUnit}
	/>
</div>
