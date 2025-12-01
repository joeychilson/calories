<script lang="ts">
	import CalorieRadialChart from '$lib/components/dashboard/calorie-radial-chart.svelte';
	import AddMealDialog from '$lib/components/dialog/dialog-add-meal.svelte';
	import DatePickerDialog from '$lib/components/dialog/dialog-date-picker.svelte';
	import EditMealDialog from '$lib/components/dialog/dialog-edit-meal.svelte';
	import LogWeightDialog from '$lib/components/dialog/dialog-log-weight.svelte';
	import SettingsDialog from '$lib/components/dialog/dialog-settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { addMeal, deleteMeal, getMeals, updateMeal } from '$lib/remote/meals.remote';
	import { getLatestWeight, getSettings, logWeight } from '$lib/remote/weight.remote';
	import { formatDate, getDisplayDate } from '$lib/utils/format';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import UtensilsIcon from '@lucide/svelte/icons/utensils';
	import { toast } from 'svelte-sonner';
	import { SvelteDate, SvelteMap } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';

	const selectedDate = new SvelteDate();
	let isAddModalOpen = $state(false);
	let isEditModalOpen = $state(false);
	let isDatePickerOpen = $state(false);
	let isWeightModalOpen = $state(false);
	let isSettingsOpen = $state(false);
	let editingMeal = $state<{
		id: string;
		name: string;
		calories: number;
		protein?: number;
		carbs?: number;
		fat?: number;
	} | null>(null);

	const initialMeals = await getMeals();
	const initialSettings = await getSettings();
	const initialLatestWeight = await getLatestWeight();

	const meals = $derived(getMeals().current ?? initialMeals);
	const settings = $derived(getSettings().current ?? initialSettings);
	const latestWeight = $derived(getLatestWeight().current ?? initialLatestWeight);

	let currentDayMeals = $derived.by(() => {
		const dateStr = formatDate(selectedDate);
		return meals
			.filter((m) => m.date === dateStr)
			.sort((a, b) => b.timestamp - a.timestamp);
	});

	let calorieGoal = $derived(settings?.calorieGoal ?? 2200);
	let weightGoal = $derived(settings?.weightGoal ?? null);
	let weightUnit = $derived(settings?.weightUnit ?? 'lbs');
	let currentWeight = $derived(latestWeight?.weight ?? null);

	let history = $derived.by(() => {
		const historyMap = new SvelteMap<string, number>();
		meals.forEach((m) => {
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
			}).updates(getMeals());

			toast.success('Meal logged!');
		} catch (err) {
			console.error('Failed to add meal:', err);
			toast.error('Failed to log meal');
		}
	}

	async function handleUpdateMeal(meal: {
		id: string;
		name: string;
		calories: number;
		protein?: number;
		carbs?: number;
		fat?: number;
	}) {
		try {
			await updateMeal(meal).updates(getMeals());
			toast.success('Meal updated');
		} catch (err) {
			console.error('Failed to update meal:', err);
			toast.error('Failed to update meal');
		}
	}

	async function handleDeleteMeal(id: string) {
		try {
			await deleteMeal(id).updates(getMeals());
			toast.success('Meal deleted');
		} catch (err) {
			console.error('Failed to delete meal:', err);
			toast.error('Failed to delete meal');
		}
	}

	async function handleLogWeight(weight: number) {
		try {
			await logWeight({ weight }).updates(getLatestWeight());
			toast.success('Weight logged!');
		} catch (err) {
			console.error('Failed to log weight:', err);
			toast.error('Failed to log weight');
		}
	}
	function formatTime(timestamp: number) {
		return new Date(timestamp).toLocaleTimeString([], {
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Calories</title>
</svelte:head>

<div class="flex h-full flex-col bg-background">
	<div class="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden">
		<!-- Minimal Header -->
		<header class="flex shrink-0 items-center justify-between px-4 py-2">
			<Button variant="ghost" size="icon" class="rounded-full" onclick={() => handleDateChange(-1)}>
				<ChevronLeftIcon class="size-5 text-muted-foreground" />
			</Button>

			<button class="flex flex-col items-center" onclick={() => (isDatePickerOpen = true)}>
				<span class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
					{selectedDate.getFullYear()}
				</span>
				<span class="text-lg font-bold text-foreground">
					{getDisplayDate(selectedDate)}
				</span>
			</button>

			<Button
				variant="ghost"
				size="icon"
				class="rounded-full"
				onclick={() => handleDateChange(1)}
				disabled={formatDate(selectedDate) === formatDate(new Date())}
			>
				<ChevronRightIcon class="size-5 text-muted-foreground" />
			</Button>
		</header>

		<div class="flex-1 overflow-hidden px-6 pb-20">
			<div class="flex h-full flex-col gap-6">
				<!-- Top Section: Chart & Quick Actions -->
				<div class="flex shrink-0 flex-col gap-6">
					<!-- Chart Section -->
					<div class="flex flex-col items-center justify-center py-2">
						<CalorieRadialChart
							meals={currentDayMeals.map((m) => ({
								id: m.id,
								name: m.name,
								calories: m.calories
							}))}
							goal={calorieGoal}
							size={240}
							thickness={20}
						/>
					</div>

					<!-- Quick Actions -->
					<div class="grid grid-cols-2 gap-3">
						<button
							class="bg-muted/30 hover:bg-muted/50 group flex items-center gap-3 rounded-xl p-3 text-left transition-colors"
							onclick={() => (isSettingsOpen = true)}
						>
							<div class="bg-background shrink-0 rounded-full p-2 shadow-sm">
								<SettingsIcon
									class="text-muted-foreground group-hover:text-foreground size-4 transition-colors"
								/>
							</div>
							<div class="min-w-0 flex-1">
								<span class="block text-xs font-bold text-foreground">Settings</span>
								<span class="block truncate text-[10px] font-medium text-muted-foreground">
									{calorieGoal} kcal goal
								</span>
							</div>
						</button>

						<button
							class="bg-muted/30 hover:bg-muted/50 group flex items-center gap-3 rounded-xl p-3 text-left transition-colors"
							onclick={() => (isWeightModalOpen = true)}
						>
							<div class="bg-background shrink-0 rounded-full p-2 shadow-sm">
								<UtensilsIcon
									class="text-muted-foreground group-hover:text-foreground size-4 transition-colors"
								/>
							</div>
							<div class="min-w-0 flex-1">
								<span class="block text-xs font-bold text-foreground">Weight</span>
								<span class="block truncate text-[10px] font-medium text-muted-foreground">
									{currentWeight ? `${currentWeight} ${weightUnit}` : 'Log weight'}
								</span>
							</div>
						</button>
					</div>
				</div>

				<!-- Meal List - Scrollable Area -->
				<div class="flex min-h-0 flex-1 flex-col gap-2">
					<h2 class="flex shrink-0 items-center gap-2 text-lg font-bold">
						Meals
						<span class="bg-muted text-muted-foreground rounded-full px-2 py-1 text-xs font-medium"
							>{currentDayMeals.length}</span
						>
					</h2>

					<div class="-mr-2 flex-1 overflow-y-auto pr-2 no-scrollbar">
						{#if currentDayMeals.length === 0}
							<div
								class="text-muted-foreground bg-muted/10 border-muted rounded-3xl border border-dashed py-12 text-center"
							>
								<div
									class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted"
								>
									<UtensilsIcon class="size-6 opacity-50" />
								</div>
								<p class="font-medium">No meals logged yet</p>
								<p class="text-sm text-muted-foreground">Add your first meal to start tracking</p>
							</div>
						{:else}
							<div class="space-y-3 pb-4">
								{#each currentDayMeals as meal, i (meal.id)}
									<div
										transition:slide={{ duration: 200 }}
										class="group relative flex flex-col gap-3 rounded-3xl bg-card/50 p-4 transition-all hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-6"
									>
										<!-- Main Row -->
										<div class="flex flex-1 items-start gap-4">
											<!-- Image -->
											<div class="relative shrink-0">
												<div
													class="h-16 w-16 overflow-hidden rounded-2xl bg-muted shadow-sm sm:h-14 sm:w-14"
												>
													{#if meal.image}
														<img
															src={meal.image}
															alt={meal.name}
															class="h-full w-full object-cover"
														/>
													{:else}
														<div class="flex h-full w-full items-center justify-center bg-muted/50">
															<UtensilsIcon class="size-6 text-muted-foreground/40" />
														</div>
													{/if}
												</div>
											</div>

											<!-- Content -->
											<div class="min-w-0 flex-1 space-y-1 pt-0.5">
												<div class="flex items-start justify-between gap-4">
													<div class="flex items-start gap-2">
														<div
															class="mt-1.5 h-2 w-2 shrink-0 rounded-full shadow-sm ring-1 ring-white/10"
															style="background-color: var(--chart-{(i % 5) + 1})"
														></div>
														<div>
															<h3 class="font-bold leading-tight text-foreground line-clamp-2">
																{meal.name}
															</h3>
															<p class="text-xs font-medium text-muted-foreground/80">
																{formatTime(meal.timestamp)}
															</p>
														</div>
													</div>

													<!-- Menu Trigger (Mobile & Desktop) -->
													<div class="absolute right-2 top-2 sm:static sm:right-auto sm:top-auto">
														<DropdownMenu.Root>
															<DropdownMenu.Trigger
																class="flex size-8 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
															>
																<EllipsisIcon class="size-4" />
															</DropdownMenu.Trigger>
															<DropdownMenu.Content align="end">
																<DropdownMenu.Item
																	onclick={() => {
																		editingMeal = {
																			id: meal.id,
																			name: meal.name,
																			calories: meal.calories,
																			protein: meal.protein ?? undefined,
																			carbs: meal.carbs ?? undefined,
																			fat: meal.fat ?? undefined
																		};
																		isEditModalOpen = true;
																	}}
																>
																	<PencilIcon class="mr-2 size-4" />
																	Edit
																</DropdownMenu.Item>
																<DropdownMenu.Item
																	class="text-destructive focus:text-destructive"
																	onclick={() => handleDeleteMeal(meal.id)}
																>
																	<Trash2Icon class="mr-2 size-4" />
																	Delete
																</DropdownMenu.Item>
															</DropdownMenu.Content>
														</DropdownMenu.Root>
													</div>
												</div>

												<div class="flex items-center justify-between gap-4">
													<!-- Macros -->
													{#if meal.protein || meal.carbs || meal.fat}
														<div
															class="flex flex-wrap items-center gap-1.5 text-[11px] font-medium"
														>
															{#if meal.protein}
																<span class="text-blue-500 dark:text-blue-400"
																	>{meal.protein}g P</span
																>
															{/if}
															{#if meal.carbs}
																<span class="text-muted-foreground/40">•</span>
																<span class="text-amber-500 dark:text-amber-400"
																	>{meal.carbs}g C</span
																>
															{/if}
															{#if meal.fat}
																<span class="text-muted-foreground/40">•</span>
																<span class="text-rose-500 dark:text-rose-400">{meal.fat}g F</span>
															{/if}
														</div>
													{:else}
														<div></div>
													{/if}

													<!-- Calories -->
													<div class="flex items-baseline gap-1 text-right">
														<span class="text-lg font-bold tabular-nums leading-none"
															>{meal.calories}</span
														>
														<span
															class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60"
															>kcal</span
														>
													</div>
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Floating Action Button -->
		<div class="fixed bottom-8 left-1/2 z-30 -translate-x-1/2">
			<Button
				size="lg"
				class="group relative h-14 rounded-full border-t border-white/5 bg-primary px-8 shadow-lg transition-all hover:scale-105 active:scale-95"
				onclick={() => (isAddModalOpen = true)}
			>
				<PlusIcon
					class="mr-2 size-5 stroke-3 transition-transform duration-300 group-hover:rotate-90"
				/>
				<span class="font-bold tracking-wide">Log Meal</span>
			</Button>
		</div>
	</div>

	<AddMealDialog bind:open={isAddModalOpen} onAdd={handleAddMeal} />
	<EditMealDialog bind:open={isEditModalOpen} meal={editingMeal} onSave={handleUpdateMeal} />
	<DatePickerDialog bind:open={isDatePickerOpen} date={selectedDate} {history} />
	<LogWeightDialog
		bind:open={isWeightModalOpen}
		onSave={handleLogWeight}
		currentWeight={currentWeight ?? 0}
		unit={weightUnit}
	/>
	<SettingsDialog
		bind:open={isSettingsOpen}
		currentCalorieGoal={calorieGoal}
		currentWeightGoal={weightGoal}
		{currentWeight}
		{weightUnit}
		onSave={() => getSettings().refresh()}
	/>
</div>
