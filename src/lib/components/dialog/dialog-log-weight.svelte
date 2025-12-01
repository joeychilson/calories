<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import ScaleIcon from '@lucide/svelte/icons/scale';
	import ResponsiveDialog from './dialog-responsive.svelte';

	let {
		open = $bindable(false),
		onSave,
		currentWeight = 0,
		unit = 'lbs'
	}: {
		open?: boolean;
		onSave?: (weight: number) => void;
		currentWeight?: number;
		unit?: string;
	} = $props();

	let weight = $state('');

	$effect(() => {
		if (open && currentWeight) {
			weight = String(currentWeight);
		}
	});

	function handleSubmit() {
		if (!weight) return;
		onSave?.(parseFloat(weight));
		open = false;
	}
</script>

<ResponsiveDialog
	bind:open
	title="Log Weight"
	subtitle="Track your progress over time."
	contentClass="sm:max-w-[425px]"
>
	<div class="py-6 space-y-6">
		<div class="flex justify-center">
			<div class="bg-primary/10 p-4 rounded-full">
				<ScaleIcon class="size-8 text-primary" />
			</div>
		</div>

		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="weight" class="text-center block">Current Weight</Label>
				<div class="relative max-w-[200px] mx-auto">
					<Input
						id="weight"
						type="number"
						step="0.1"
						placeholder="0.0"
						bind:value={weight}
						class="text-3xl text-center h-16 font-bold"
					/>
					<div
						class="text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2 font-medium pointer-events-none"
					>
						{unit}
					</div>
				</div>
			</div>
		</div>

		<Button onclick={handleSubmit} disabled={!weight} class="w-full py-6 text-lg">
			Save Weight
		</Button>
	</div>
</ResponsiveDialog>
