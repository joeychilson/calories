<script lang="ts">
	import AddMealDialog from '$lib/components/dialog/dialog-add-meal.svelte';
	import DatePickerDialog from '$lib/components/dialog/dialog-date-picker.svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils/ui';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import UtensilsIcon from '@lucide/svelte/icons/utensils';
	import { SvelteDate, SvelteMap } from 'svelte/reactivity';

	type Meal = {
		id: string;
		name: string;
		calories: number;
		image: string | null;
		date: string;
		timestamp: number;
	};

	const selectedDate = new SvelteDate();
	let isAddModalOpen = $state(false);
	let isDatePickerOpen = $state(false);

	let meals = $state<Meal[]>([
		{
			id: 'prev-1',
			name: 'Oatmeal',
			calories: 350,
			image: null,
			date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
			timestamp: Date.now() - 86400000
		},
		{
			id: 'prev-2',
			name: 'Salad',
			calories: 400,
			image: null,
			date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
			timestamp: Date.now() - 86300000
		}
	]);

	const dailyGoal = 2200;

	const formatDate = (date: Date) => {
		return date.toISOString().split('T')[0];
	};

	const getDisplayDate = (date: Date) => {
		const today = new SvelteDate();
		const yesterday = new SvelteDate(today);
		yesterday.setDate(yesterday.getDate() - 1);

		const dString = formatDate(date);
		const tString = formatDate(today);
		const yString = formatDate(yesterday);

		if (dString === tString) return 'Today';
		if (dString === yString) return 'Yesterday';

		return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	};

	let currentDayMeals = $derived.by(() => {
		const dateStr = formatDate(selectedDate);
		return meals.filter((m) => m.date === dateStr).sort((a, b) => b.timestamp - a.timestamp);
	});

	let totalCalories = $derived.by(() => {
		return currentDayMeals.reduce((acc, curr) => acc + curr.calories, 0);
	});

	let remainingCalories = $derived(dailyGoal - totalCalories);
	let progressPercentage = $derived(Math.min(100, Math.max(0, (totalCalories / dailyGoal) * 100)));
	let isOver = $derived(totalCalories > dailyGoal);

	let history = $derived.by(() => {
		const historyMap = new SvelteMap<string, number>();
		meals.forEach((m) => {
			const current = historyMap.get(m.date) || 0;
			historyMap.set(m.date, current + m.calories);
		});

		return Array.from(historyMap.entries()).map(([date, cals]) => ({
			date,
			status:
				cals > dailyGoal
					? 'over'
					: ((cals > dailyGoal * 0.8 ? 'met' : 'under') as 'over' | 'met' | 'under')
		}));
	});

	function handleDateChange(days: number) {
		selectedDate.setDate(selectedDate.getDate() + days);
	}

	function handleAddMeal(meal: { name: string; calories: number; image: string | null }) {
		const newMeal: Meal = {
			id: Math.random().toString(36).substr(2, 9),
			...meal,
			date: formatDate(selectedDate),
			timestamp: Date.now()
		};
		meals = [newMeal, ...meals];
	}

	function handleDeleteMeal(id: string) {
		meals = meals.filter((m) => m.id !== id);
	}
</script>

<div class="bg-muted/20 min-h-screen pb-28 font-sans pt-14">
	<header
		class="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-14 z-10 px-4 pt-4 pb-2 backdrop-blur-xl border-b border-border/5"
	>
		<div class="mx-auto flex max-w-md items-center justify-between">
			<Button
				variant="ghost"
				size="icon"
				class="rounded-full hover:bg-muted"
				onclick={() => handleDateChange(-1)}
			>
				<ChevronLeftIcon class="size-5 text-muted-foreground" />
			</Button>

			<button
				class="flex flex-col items-center cursor-pointer group rounded-lg px-3 py-1 hover:bg-muted/50 transition-colors"
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
		</div>
	</header>

	<main class="mx-auto max-w-md px-4 pt-6">
		<div class="animate-in fade-in zoom-in duration-500 mb-8">
			<div class="relative mx-auto flex h-56 w-56 items-center justify-center">
				<svg class="h-full w-full -rotate-90 transform">
					<circle
						cx="112"
						cy="112"
						r="96"
						stroke="currentColor"
						stroke-width="14"
						fill="transparent"
						class="text-muted/50 stroke-current"
					/>
					<circle
						cx="112"
						cy="112"
						r="96"
						stroke="currentColor"
						stroke-width="14"
						fill="transparent"
						stroke-dasharray={2 * Math.PI * 96}
						stroke-dashoffset={2 * Math.PI * 96 - (progressPercentage / 100) * 2 * Math.PI * 96}
						class={cn(
							'transition-all duration-1000 ease-out',
							isOver ? 'text-destructive' : 'text-primary'
						)}
						stroke-linecap="round"
					/>
				</svg>
				<div class="absolute flex flex-col items-center gap-1">
					<span class="text-foreground text-5xl font-bold tracking-tighter">
						{totalCalories}
					</span>
					<span class="text-muted-foreground text-xs font-bold uppercase tracking-widest">
						/ {dailyGoal} kcal
					</span>
				</div>
			</div>

			<div class="mt-8 grid grid-cols-3 gap-4 text-center">
				<div class="bg-card/50 rounded-2xl p-3 backdrop-blur-sm">
					<p class="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Eaten</p>
					<p class="text-foreground text-xl font-bold">{totalCalories}</p>
				</div>
				<div class="bg-card/50 rounded-2xl p-3 backdrop-blur-sm">
					<p class="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Goal</p>
					<p class="text-foreground text-xl font-bold">{dailyGoal}</p>
				</div>
				<div class="bg-card/50 rounded-2xl p-3 backdrop-blur-sm">
					<p class="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Left</p>
					<p
						class="text-xl font-bold {remainingCalories < 0
							? 'text-destructive'
							: 'text-emerald-500'}"
					>
						{remainingCalories}
					</p>
				</div>
			</div>
		</div>
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<h2 class="text-foreground flex items-center gap-2 text-lg font-bold">
					Meals <span
						class="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-bold"
						>{currentDayMeals.length}</span
					>
				</h2>
			</div>
			{#if currentDayMeals.length === 0}
				<div
					class="bg-card/50 border-muted/40 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed py-16 text-center"
				>
					<div
						class="bg-muted text-muted-foreground mb-4 flex h-16 w-16 items-center justify-center rounded-full"
					>
						<UtensilsIcon class="size-7" />
					</div>
					<p class="text-muted-foreground font-medium">No meals logged today</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each currentDayMeals as meal (meal.id)}
						<div
							class="bg-card hover:border-primary/20 group relative overflow-hidden rounded-2xl border shadow-sm transition-all"
						>
							<div class="flex gap-4 p-3">
								<div class="bg-muted relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
									{#if meal.image}
										<img
											src={meal.image}
											alt={meal.name}
											class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
										/>
									{:else}
										<div
											class="text-muted-foreground flex h-full w-full items-center justify-center"
										>
											<UtensilsIcon class="size-6" />
										</div>
									{/if}
								</div>
								<div class="flex flex-1 flex-col justify-center gap-1">
									<h3 class="text-foreground truncate pr-8 font-bold leading-none">{meal.name}</h3>
									<div class="flex items-baseline gap-1">
										<p class="text-primary text-lg font-bold leading-none">
											{meal.calories}
										</p>
										<span class="text-muted-foreground text-xs font-medium">kcal</span>
									</div>
									<p class="text-muted-foreground text-xs font-medium">
										{new Date(meal.timestamp).toLocaleTimeString([], {
											hour: '2-digit',
											minute: '2-digit'
										})}
									</p>
								</div>
								<button
									onclick={() => handleDeleteMeal(meal.id)}
									class="text-muted-foreground hover:text-destructive hover:bg-destructive/10 absolute top-2 right-2 rounded-full p-2 opacity-0 transition-all group-hover:opacity-100 focus:opacity-100"
								>
									<Trash2Icon class="size-4" />
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</main>
	<div class="fixed bottom-6 left-0 right-0 z-20 flex justify-center pointer-events-none">
		<Button
			size="lg"
			class="bg-foreground text-background hover:bg-foreground/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 h-14 rounded-full px-8 shadow-lg shadow-black/5 transition-all hover:scale-105 hover:shadow-xl active:scale-95 pointer-events-auto"
			onclick={() => (isAddModalOpen = true)}
		>
			<PlusIcon class="mr-2 size-5 stroke-3" />
			<span class="text-base font-bold">Log Meal</span>
		</Button>
	</div>
	<AddMealDialog bind:open={isAddModalOpen} onAdd={handleAddMeal} />
	<DatePickerDialog bind:open={isDatePickerOpen} date={selectedDate} {history} />
</div>
