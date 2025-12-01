<script lang="ts">
	import { buttonVariants } from '$lib/components/ui/button';
	import { Calendar } from '$lib/components/ui/calendar';
	import { cn } from '$lib/utils/ui';
	import { CalendarDate, type DateValue, getLocalTimeZone } from '@internationalized/date';
	import { Calendar as CalendarPrimitive } from 'bits-ui';
	import ResponsiveDialog from './dialog-responsive.svelte';

	let {
		open = $bindable(false),
		date = $bindable(new Date()),
		history = []
	}: {
		open?: boolean;
		date: Date;
		history?: { date: string; status: 'met' | 'under' | 'over' }[];
	} = $props();

	let value = $state<DateValue | undefined>(undefined);

	function toCalendarDate(d: Date): DateValue {
		return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
	}

	function toDate(d: DateValue): Date {
		return d.toDate(getLocalTimeZone());
	}

	$effect(() => {
		if (date) {
			const newVal = toCalendarDate(date);
			if (!value || value.compare(newVal) !== 0) {
				value = newVal;
			}
		}
	});

	function handleValueChange(newValue: DateValue | undefined) {
		if (newValue) {
			value = newValue;
			date.setTime(toDate(newValue).getTime());
			setTimeout(() => {
				open = false;
			}, 50);
		}
	}

	function getStatus(day: DateValue) {
		const dateStr = day.toString();
		return history.find((h) => h.date === dateStr)?.status;
	}
</script>

<ResponsiveDialog
	bind:open
	title="Select Date"
	subtitle="View past meals and progress."
	contentClass="w-auto max-w-sm p-0 overflow-hidden rounded-[1.5rem]"
	headerClass="px-6 pt-6"
>
	<div class="p-4 flex justify-center bg-background">
		<Calendar
			type="single"
			bind:value
			onValueChange={handleValueChange}
			class="shadow-none border-0 w-full p-3"
			fixedWeeks
		>
			{#snippet day({ day, outsideMonth })}
				<CalendarPrimitive.Day
					class={cn(
						buttonVariants({ variant: 'ghost' }),
						'size-(--cell-size) flex select-none flex-col items-center justify-center gap-1 whitespace-nowrap p-0 font-normal leading-none',
						'[&[data-today]:not([data-selected])]:bg-accent [&[data-today]:not([data-selected])]:text-accent-foreground [&[data-today][data-disabled]]:text-muted-foreground',
						'data-selected:bg-primary dark:data-selected:hover:bg-accent/50 data-selected:text-primary-foreground',
						'[&[data-outside-month]:not([data-selected])]:text-muted-foreground [&[data-outside-month]:not([data-selected])]:hover:text-accent-foreground',
						'data-disabled:text-muted-foreground data-disabled:pointer-events-none data-disabled:opacity-50',
						'data-unavailable:text-muted-foreground data-unavailable:line-through',
						'dark:hover:text-accent-foreground',
						'focus:border-ring focus:ring-ring/50 focus:relative',
						'rounded-full',
						outsideMonth && 'opacity-30'
					)}
				>
					<div class="relative flex items-center justify-center size-full">
						{day.day}
						{#if !outsideMonth}
							{#if getStatus(day) === 'met'}
								<div class="absolute bottom-1.5 size-1 rounded-full bg-emerald-500"></div>
							{:else if getStatus(day) === 'over'}
								<div class="absolute bottom-1.5 size-1 rounded-full bg-destructive"></div>
							{:else if getStatus(day) === 'under'}
								<div class="absolute bottom-1.5 size-1 rounded-full bg-orange-400"></div>
							{/if}
						{/if}
					</div>
				</CalendarPrimitive.Day>
			{/snippet}
		</Calendar>
	</div>
</ResponsiveDialog>
