<script lang="ts">
	import { browser } from '$app/environment';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import { formatTime } from '$lib/utils/format';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import UtensilsIcon from '@lucide/svelte/icons/utensils';
	import { slide } from 'svelte/transition';

	type Meal = {
		id: string;
		name: string;
		calories: number;
		servings?: number;
		protein?: number | null;
		carbs?: number | null;
		fat?: number | null;
		image?: string | null;
		timestamp: number;
	};

	let {
		meal,
		index,
		onEdit,
		onDelete
	}: {
		meal: Meal;
		index: number;
		onEdit: (meal: Meal) => void;
		onDelete: (id: string) => void;
	} = $props();
</script>

<div
	transition:slide={{ duration: 200 }}
	class="group relative overflow-hidden rounded-2xl bg-muted/30 transition-colors hover:bg-muted/50"
>
	<div class="flex items-stretch">
		<div
			class="w-1 shrink-0 rounded-l-2xl"
			style="background-color: var(--chart-{(index % 5) + 1})"
		></div>
		<div class="relative w-20 shrink-0">
			{#if meal.image}
				<img src={meal.image} alt={meal.name} class="absolute inset-0 h-full w-full object-cover" />
			{:else}
				<div
					class="absolute inset-0 flex items-center justify-center bg-linear-to-br from-muted/80 to-muted/40"
				>
					<UtensilsIcon class="size-5 text-muted-foreground/30" />
				</div>
			{/if}
		</div>
		<div class="flex min-w-0 flex-1 flex-col justify-center gap-2 p-3">
			<div class="flex items-start justify-between gap-2">
				<div class="min-w-0 flex-1">
					<h3 class="line-clamp-1 font-bold leading-snug text-foreground">
						{meal.name}
					</h3>
					<p class="text-[11px] text-muted-foreground">
						{#if browser}
							{formatTime(meal.timestamp)}
						{/if}
					</p>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger
						class="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground sm:opacity-0 sm:focus:opacity-100 sm:group-hover:opacity-100"
					>
						<EllipsisIcon class="size-4" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onclick={() => onEdit(meal)}>
							<PencilIcon class="mr-2 size-4" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem
							class="text-destructive focus:text-destructive"
							onclick={() => onDelete(meal.id)}
						>
							<Trash2Icon class="mr-2 size-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<div class="flex items-center justify-between gap-3">
				<div class="flex items-center gap-1">
					<span
						class="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-500 dark:bg-blue-400/10 dark:text-blue-400"
					>
						{meal.protein ?? 0}g P
					</span>
					<span
						class="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500 dark:bg-amber-400/10 dark:text-amber-400"
					>
						{meal.carbs ?? 0}g C
					</span>
					<span
						class="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-500 dark:bg-rose-400/10 dark:text-rose-400"
					>
						{meal.fat ?? 0}g F
					</span>
				</div>
				<div class="flex items-baseline gap-0.5 rounded-lg bg-foreground/5 px-2 py-1">
					<span class="text-base font-bold tabular-nums leading-none">{meal.calories}</span>
					<span class="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
						kcal
					</span>
				</div>
			</div>
		</div>
	</div>
</div>
