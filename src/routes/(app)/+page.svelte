<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import CalorieRadialChart from '$lib/components/dashboard/calorie-radial-chart.svelte';
	import AddMealDialog from '$lib/components/dialog/dialog-add-meal.svelte';
	import DatePickerDialog from '$lib/components/dialog/dialog-date-picker.svelte';
	import EditMealDialog from '$lib/components/dialog/dialog-edit-meal.svelte';
	import LogWeightDialog from '$lib/components/dialog/dialog-log-weight.svelte';
	import SettingsDialog from '$lib/components/dialog/dialog-settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import { addMeal, deleteMeal, getMeals, updateMeal } from '$lib/remote/meals.remote';
	import { getSettings } from '$lib/remote/settings.remote';
	import { getLatestWeight, logWeight } from '$lib/remote/weight.remote';
	import { formatDate, formatTime, getDisplayDate } from '$lib/utils/format';
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

	function parseDateParam(param: string | null): Date {
		if (!param) return new Date();
		const parsed = new Date(param + 'T00:00:00');
		return isNaN(parsed.getTime()) ? new Date() : parsed;
	}

	const initialDateParam = page.url.searchParams.get('d');
	const selectedDate = new SvelteDate(parseDateParam(initialDateParam));

	function updateUrlDate(date: Date) {
		const todayStr = formatDate(new Date());
		const dateStr = formatDate(date);

		if (dateStr === todayStr) {
			goto('/', { replaceState: true, keepFocus: true, noScroll: true });
		} else {
			goto(`/?d=${dateStr}`, { replaceState: true, keepFocus: true, noScroll: true });
		}
	}
	let isAddModalOpen = $state(false);
	let isEditModalOpen = $state(false);
	let isDatePickerOpen = $state(false);
	let isWeightModalOpen = $state(false);
	let isSettingsOpen = $state(false);

	let wasDatePickerOpen = $state(false);
	$effect(() => {
		if (wasDatePickerOpen && !isDatePickerOpen) {
			updateUrlDate(selectedDate);
		}
		wasDatePickerOpen = isDatePickerOpen;
	});

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
	const initialSettings = await getSettings();
	const initialLatestWeight = await getLatestWeight();

	const meals = $derived(getMeals().current ?? initialMeals);
	const settings = $derived(getSettings().current ?? initialSettings);
	const latestWeight = $derived(getLatestWeight().current ?? initialLatestWeight);

	let currentDayMeals = $derived.by(() => {
		const dateStr = formatDate(selectedDate);
		return meals.filter((m) => m.date === dateStr).sort((a, b) => b.timestamp - a.timestamp);
	});

	let calorieGoal = $derived(settings?.calorieGoal ?? 2200);
	let weightGoal = $derived(settings?.weightGoal ?? null);
	let weightUnit = $derived(settings?.weightUnit ?? 'lbs');
	let currentWeight = $derived(latestWeight?.weight ?? null);

	let history = $derived.by(() => {
		const historyMap = new SvelteMap<string, number>();
		for (const m of meals) {
			historyMap.set(m.date, (historyMap.get(m.date) || 0) + m.calories);
		}

		return Array.from(historyMap.entries()).map(([date, cals]) => ({
			date,
			status:
				cals > calorieGoal
					? 'over'
					: ((cals > calorieGoal * 0.8 ? 'met' : 'under') as 'over' | 'met' | 'under')
		}));
	});

	let totalProtein = $derived(currentDayMeals.reduce((acc, m) => acc + (m.protein || 0), 0));
	let totalCarbs = $derived(currentDayMeals.reduce((acc, m) => acc + (m.carbs || 0), 0));
	let totalFat = $derived(currentDayMeals.reduce((acc, m) => acc + (m.fat || 0), 0));

	function handleDateChange(days: number) {
		selectedDate.setDate(selectedDate.getDate() + days);
		updateUrlDate(selectedDate);
	}

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
		const mealTime = new Date(
			selectedDate.getFullYear(),
			selectedDate.getMonth(),
			selectedDate.getDate(),
			new Date().getHours(),
			new Date().getMinutes(),
			new Date().getSeconds()
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
				mealDate: formatDate(selectedDate),
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

	async function handleLogWeight(weight: number) {
		try {
			await logWeight({ weight }).updates(getLatestWeight());
		} catch (err) {
			console.error('Failed to log weight:', err);
			toast.error('Failed to log weight');
		}
	}
</script>

<svelte:head>
	<title>Calories</title>
	<meta
		name="description"
		content="Calories is a simple app to help you track your calories and progress."
	/>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex h-full flex-col bg-background">
	<div class="mx-auto flex h-full w-full max-w-md flex-col">
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

		<div class="flex min-h-0 flex-1 flex-col px-6">
			<div class="flex min-h-0 flex-1 flex-col gap-4">
				<div class="shrink-0">
					<div class="flex flex-col items-center justify-center py-2">
						<CalorieRadialChart
							meals={currentDayMeals.map((m) => ({
								id: m.id,
								name: m.name,
								calories: m.calories
							}))}
							goal={calorieGoal}
							size={200}
							thickness={16}
						/>

						{#if totalProtein > 0 || totalCarbs > 0 || totalFat > 0}
							<div class="mt-2 flex items-center gap-8" transition:slide>
								<div class="flex flex-col items-center">
									<span class="text-lg font-bold text-blue-500 dark:text-blue-400"
										>{totalProtein}g</span
									>
									<span
										class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60"
										>Protein</span
									>
								</div>
								<div class="h-8 w-px bg-border/50"></div>
								<div class="flex flex-col items-center">
									<span class="text-lg font-bold text-amber-500 dark:text-amber-400"
										>{totalCarbs}g</span
									>
									<span
										class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60"
										>Carbs</span
									>
								</div>
								<div class="h-8 w-px bg-border/50"></div>
								<div class="flex flex-col items-center">
									<span class="text-lg font-bold text-rose-500 dark:text-rose-400">{totalFat}g</span
									>
									<span
										class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60"
										>Fat</span
									>
								</div>
							</div>
						{/if}
					</div>
					<div class="mt-4 flex w-full flex-col gap-2">
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
						<Button
							size="lg"
							class="h-12 w-full rounded-xl bg-primary font-bold shadow-sm transition-all active:scale-[0.98]"
							onclick={() => (isAddModalOpen = true)}
						>
							<PlusIcon class="size-5" />
							Log Meal
						</Button>
					</div>
				</div>
				<div class="flex min-h-0 flex-1 flex-col gap-2">
					<h2 class="shrink-0 flex items-center gap-2 text-lg font-bold">
						Meals
						<span class="bg-muted text-muted-foreground rounded-full px-2 py-1 text-xs font-medium"
							>{currentDayMeals.length}</span
						>
					</h2>
					<div class="min-h-0 flex-1 overflow-y-auto">
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
										<div class="flex flex-1 items-start gap-4">
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
																{#if browser}
																	{formatTime(meal.timestamp)}
																{/if}
															</p>
														</div>
													</div>
													<div class="absolute right-2 top-2 sm:static sm:right-auto sm:top-auto">
														<DropdownMenu>
															<DropdownMenuTrigger
																class="flex size-8 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
															>
																<EllipsisIcon class="size-4" />
															</DropdownMenuTrigger>
															<DropdownMenuContent align="end">
																<DropdownMenuItem
																	onclick={() => {
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
																	}}
																>
																	<PencilIcon class="mr-2 size-4" />
																	Edit
																</DropdownMenuItem>
																<DropdownMenuItem
																	class="text-destructive focus:text-destructive"
																	onclick={() => handleDeleteMeal(meal.id)}
																>
																	<Trash2Icon class="mr-2 size-4" />
																	Delete
																</DropdownMenuItem>
															</DropdownMenuContent>
														</DropdownMenu>
													</div>
												</div>
												<div class="flex items-center justify-between gap-4">
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
													{/if}
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
