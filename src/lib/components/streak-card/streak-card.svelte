<script lang="ts">
	import { getMeals } from '$lib/remote/meals.remote';
	import { formatDate } from '$lib/utils/format';
	import FlameIcon from '@lucide/svelte/icons/flame';

	const initialMeals = await getMeals();
	const meals = $derived(getMeals().current ?? initialMeals);

	const loggedDates = $derived.by(() => {
		if (!meals || meals.length === 0) return new Set<string>();
		return new Set(meals.map((m) => m.date));
	});

	const currentStreak = $derived.by(() => {
		if (loggedDates.size === 0) return 0;

		let streak = 0;
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const todayStr = formatDate(today);
		let checkDate = new Date(today);

		if (!loggedDates.has(todayStr)) {
			checkDate.setDate(checkDate.getDate() - 1);
		}

		while (true) {
			const dateStr = formatDate(checkDate);
			if (loggedDates.has(dateStr)) {
				streak++;
				checkDate.setDate(checkDate.getDate() - 1);
			} else {
				break;
			}
		}

		return streak;
	});

	const longestStreak = $derived.by(() => {
		if (loggedDates.size === 0) return 0;

		const sortedDates = Array.from(loggedDates).sort();
		let longest = 1;
		let current = 1;

		for (let i = 1; i < sortedDates.length; i++) {
			const prevDate = new Date(sortedDates[i - 1]);
			const currDate = new Date(sortedDates[i]);
			const diffDays = Math.round(
				(currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
			);

			if (diffDays === 1) {
				current++;
				longest = Math.max(longest, current);
			} else {
				current = 1;
			}
		}

		return longest;
	});

	const isOnFire = $derived(currentStreak >= 3);
</script>

<div class="flex items-center gap-3 rounded-xl bg-muted/30 p-4">
	<div
		class="flex size-12 shrink-0 items-center justify-center rounded-xl {isOnFire
			? 'bg-orange-500/10'
			: 'bg-muted/50'}"
	>
		<FlameIcon class="size-6 {isOnFire ? 'text-orange-500' : 'text-muted-foreground'}" />
	</div>
	<div class="min-w-0 flex-1">
		<div class="flex items-baseline gap-1">
			<span class="text-2xl font-bold tabular-nums">{currentStreak}</span>
			<span class="text-sm text-muted-foreground">day{currentStreak !== 1 ? 's' : ''}</span>
		</div>
		<span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
			{#if currentStreak === 0}
				Log a meal to start your streak
			{:else if isOnFire}
				You're on fire! Keep it up
			{:else}
				Current streak
			{/if}
		</span>
	</div>
	{#if longestStreak > currentStreak}
		<div class="text-right">
			<div class="text-sm font-bold tabular-nums text-muted-foreground">{longestStreak}</div>
			<span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
				Best
			</span>
		</div>
	{/if}
</div>
