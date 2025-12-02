<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		InputGroup,
		InputGroupAddon,
		InputGroupInput,
		InputGroupText
	} from '$lib/components/ui/input-group';
	import { Label } from '$lib/components/ui/label';
	import { completeOnboarding, getSettings, optimizeCalories } from '$lib/remote/settings.remote';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CheckIcon from '@lucide/svelte/icons/check';
	import FlameIcon from '@lucide/svelte/icons/flame';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import TrendingDownIcon from '@lucide/svelte/icons/trending-down';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import { toast } from 'svelte-sonner';
	import { fade, fly } from 'svelte/transition';

	let {
		open = $bindable(false),
		onComplete
	}: {
		open?: boolean;
		onComplete?: () => void;
	} = $props();

	let step = $state(0);
	let weightUnit = $state<'lbs' | 'kg'>('lbs');
	let currentWeight = $state('');
	let goalWeight = $state('');
	let calorieGoal = $state('2200');
	let saving = $state(false);
	let optimizing = $state(false);
	let aiResult = $state<{ calories: number; timeline: string; explanation: string } | null>(null);

	const totalSteps = 4;

	function nextStep() {
		if (step < totalSteps - 1) {
			step++;
		}
	}

	function prevStep() {
		if (step > 0) {
			step--;
		}
	}

	async function handleOptimize() {
		if (!currentWeight || !goalWeight) return;

		optimizing = true;
		aiResult = null;

		try {
			const result = await optimizeCalories({
				currentWeight: parseFloat(currentWeight),
				goalWeight: parseFloat(goalWeight),
				unit: weightUnit
			});

			aiResult = result;
			calorieGoal = String(result.calories);
		} catch (err) {
			console.error('Optimization failed:', err);
			toast.error('Failed to get AI recommendation');
		} finally {
			optimizing = false;
		}
	}

	async function handleComplete() {
		if (!calorieGoal) return;

		saving = true;

		try {
			await completeOnboarding({
				calorieGoal: parseInt(calorieGoal),
				weightGoal: goalWeight ? parseFloat(goalWeight) : undefined,
				weightUnit,
				currentWeight: currentWeight ? parseFloat(currentWeight) : undefined
			}).updates(getSettings());

			open = false;
			onComplete?.();
		} catch (err) {
			console.error('Failed to complete onboarding:', err);
			toast.error('Failed to save settings');
		} finally {
			saving = false;
		}
	}

	$effect(() => {
		if (open) {
			step = 0;
			weightUnit = 'lbs';
			currentWeight = '';
			goalWeight = '';
			calorieGoal = '2200';
			aiResult = null;
		}
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-background"
		transition:fade={{ duration: 200 }}
	>
		<div class="relative flex h-full w-full max-w-md flex-col px-6 py-8 sm:h-auto sm:py-12">
			<div class="mb-8 flex items-center justify-center gap-2">
				{#each [...Array(totalSteps).keys()] as i (i)}
					<button
						class="relative h-1.5 rounded-full transition-all duration-300 {i === step
							? 'w-8 bg-foreground'
							: i < step
								? 'w-1.5 bg-foreground/60'
								: 'w-1.5 bg-muted'}"
						onclick={() => i < step && (step = i)}
						disabled={i > step}
					>
						{#if i < step}
							<span class="sr-only">Step {i + 1} completed</span>
						{/if}
					</button>
				{/each}
			</div>

			<div class="flex min-h-[420px] flex-1 flex-col">
				{#if step === 0}
					<div
						class="flex flex-1 flex-col items-center justify-center text-center"
						in:fly={{ x: 20, duration: 250, delay: 50 }}
					>
						<div class="mb-8 flex flex-col items-center">
							<div class="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
								<FlameIcon class="size-8 text-foreground" />
							</div>
							<h1 class="mb-2 text-2xl font-bold tracking-tight text-foreground">
								Welcome to Calories
							</h1>
							<p class="max-w-xs text-sm text-muted-foreground">
								Track your nutrition and reach your goals with a simple, focused experience.
							</p>
						</div>
						<div class="w-full space-y-3">
							<Button size="lg" class="h-12 w-full rounded-xl font-bold" onclick={nextStep}>
								Get Started
								<ArrowRightIcon class="ml-2 size-4" />
							</Button>
							<p class="text-xs text-muted-foreground">Takes less than a minute</p>
						</div>
					</div>
				{:else if step === 1}
					<div class="flex flex-1 flex-col" in:fly={{ x: 20, duration: 250, delay: 50 }}>
						<div class="mb-6">
							<p class="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
								Step 1
							</p>
							<h2 class="text-xl font-bold text-foreground">Your current weight</h2>
						</div>

						<div class="flex-1 space-y-6">
							<div class="space-y-3">
								<Label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
									Unit
								</Label>
								<div class="grid grid-cols-2 gap-2">
									<button
										class="relative flex h-14 items-center justify-center rounded-2xl font-bold transition-all {weightUnit ===
										'lbs'
											? 'bg-foreground text-background'
											: 'bg-muted text-muted-foreground hover:text-foreground'}"
										onclick={() => (weightUnit = 'lbs')}
									>
										<span class="text-lg">lbs</span>
									</button>
									<button
										class="relative flex h-14 items-center justify-center rounded-2xl font-bold transition-all {weightUnit ===
										'kg'
											? 'bg-foreground text-background'
											: 'bg-muted text-muted-foreground hover:text-foreground'}"
										onclick={() => (weightUnit = 'kg')}
									>
										<span class="text-lg">kg</span>
									</button>
								</div>
							</div>

							<div class="space-y-2">
								<Label
									for="currentWeight"
									class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
								>
									Current Weight <span class="font-normal">(optional)</span>
								</Label>
								<InputGroup class="h-14">
									<InputGroupInput
										id="currentWeight"
										type="number"
										step="0.1"
										class="h-full rounded-2xl text-lg font-bold"
										placeholder="0"
										bind:value={currentWeight}
									/>
									<InputGroupAddon class="rounded-r-2xl">
										<InputGroupText class="text-muted-foreground">{weightUnit}</InputGroupText>
									</InputGroupAddon>
								</InputGroup>
							</div>
						</div>

						<div class="mt-8 flex gap-3">
							<Button variant="ghost" class="h-12 flex-1 rounded-xl font-bold" onclick={prevStep}>
								Back
							</Button>
							<Button class="h-12 flex-1 rounded-xl font-bold" onclick={nextStep}>Continue</Button>
						</div>
					</div>
				{:else if step === 2}
					<div class="flex flex-1 flex-col" in:fly={{ x: 20, duration: 250, delay: 50 }}>
						<div class="mb-6">
							<p class="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
								Step 2
							</p>
							<h2 class="text-xl font-bold text-foreground">Your goal weight</h2>
						</div>

						<div class="flex-1 space-y-6">
							<div class="space-y-2">
								<Label
									for="goalWeight"
									class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
								>
									Target Weight <span class="font-normal">(optional)</span>
								</Label>
								<InputGroup class="h-14">
									<InputGroupInput
										id="goalWeight"
										type="number"
										step="0.1"
										class="h-full rounded-2xl text-lg font-bold"
										placeholder="0"
										bind:value={goalWeight}
									/>
									<InputGroupAddon class="rounded-r-2xl">
										<InputGroupText class="text-muted-foreground">{weightUnit}</InputGroupText>
									</InputGroupAddon>
								</InputGroup>
							</div>

							{#if currentWeight && goalWeight}
								{@const diff = parseFloat(currentWeight) - parseFloat(goalWeight)}
								<div
									class="flex items-center gap-4 rounded-2xl bg-muted/30 p-4"
									transition:fly={{ y: 8, duration: 200 }}
								>
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full {diff >
										0
											? 'bg-chart-2/20'
											: diff < 0
												? 'bg-chart-1/20'
												: 'bg-muted'}"
									>
										{#if diff > 0}
											<TrendingDownIcon class="size-5 text-chart-2" />
										{:else if diff < 0}
											<TrendingUpIcon class="size-5 text-chart-1" />
										{:else}
											<CheckIcon class="size-5 text-muted-foreground" />
										{/if}
									</div>
									<div>
										<p class="text-sm font-bold text-foreground">
											{#if diff > 0}
												Lose {Math.abs(diff).toFixed(1)} {weightUnit}
											{:else if diff < 0}
												Gain {Math.abs(diff).toFixed(1)} {weightUnit}
											{:else}
												Maintain weight
											{/if}
										</p>
										<p class="text-xs text-muted-foreground">
											{#if diff !== 0}
												We'll calculate optimal calories
											{:else}
												Great for staying consistent
											{/if}
										</p>
									</div>
								</div>
							{/if}
						</div>

						<div class="mt-8 flex gap-3">
							<Button variant="ghost" class="h-12 flex-1 rounded-xl font-bold" onclick={prevStep}>
								Back
							</Button>
							<Button class="h-12 flex-1 rounded-xl font-bold" onclick={nextStep}>Continue</Button>
						</div>
					</div>
				{:else if step === 3}
					<div class="flex flex-1 flex-col" in:fly={{ x: 20, duration: 250, delay: 50 }}>
						<div class="mb-6">
							<p class="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
								Step 3
							</p>
							<h2 class="text-xl font-bold text-foreground">Daily calorie goal</h2>
						</div>

						<div class="flex-1 space-y-5">
							{#if currentWeight && goalWeight}
								<button
									class="flex w-full items-center gap-4 rounded-2xl bg-muted/30 p-4 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
									onclick={handleOptimize}
									disabled={optimizing}
								>
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-chart-4/20"
									>
										{#if optimizing}
											<Loader2Icon class="size-5 animate-spin text-chart-4" />
										{:else}
											<SparklesIcon class="size-5 text-chart-4" />
										{/if}
									</div>
									<div class="flex-1">
										<p class="text-sm font-bold text-foreground">
											{optimizing ? 'Calculating...' : 'Calculate with AI'}
										</p>
										<p class="text-xs text-muted-foreground">Get a personalized recommendation</p>
									</div>
								</button>
							{/if}

							{#if aiResult}
								<div
									class="space-y-4 rounded-2xl border border-chart-4/20 bg-chart-4/5 p-4"
									transition:fly={{ y: 8, duration: 200 }}
								>
									<div class="flex items-center justify-between">
										<span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
											Recommended
										</span>
										<span class="text-xs font-medium text-chart-2">{aiResult.timeline}</span>
									</div>
									<div class="flex items-baseline gap-1">
										<span class="text-4xl font-bold tabular-nums">{aiResult.calories}</span>
										<span class="text-sm font-medium text-muted-foreground">kcal/day</span>
									</div>
									<p class="text-xs leading-relaxed text-muted-foreground">
										{aiResult.explanation}
									</p>
								</div>
							{/if}

							<div class="space-y-2">
								<Label
									for="calorieGoal"
									class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
								>
									Daily Target
								</Label>
								<InputGroup class="h-14">
									<InputGroupInput
										id="calorieGoal"
										type="number"
										class="h-full rounded-2xl text-lg font-bold"
										placeholder="2200"
										bind:value={calorieGoal}
									/>
									<InputGroupAddon class="rounded-r-2xl">
										<InputGroupText class="text-muted-foreground">kcal</InputGroupText>
									</InputGroupAddon>
								</InputGroup>
								{#if !aiResult}
									<p class="text-xs text-muted-foreground">
										Average is 2000-2500 kcal. Adjust based on your goals.
									</p>
								{/if}
							</div>
						</div>

						<div class="mt-8 flex gap-3">
							<Button variant="ghost" class="h-12 flex-1 rounded-xl font-bold" onclick={prevStep}>
								Back
							</Button>
							<Button
								class="h-12 flex-1 rounded-xl font-bold"
								onclick={handleComplete}
								disabled={!calorieGoal || saving}
							>
								{#if saving}
									<Loader2Icon class="mr-2 size-4 animate-spin" />
									Saving
								{:else}
									Complete
									<CheckIcon class="ml-2 size-4" />
								{/if}
							</Button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
