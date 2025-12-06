<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Calendar } from '$lib/components/ui/calendar';
	import {
		InputGroup,
		InputGroupAddon,
		InputGroupInput,
		InputGroupText
	} from '$lib/components/ui/input-group';
	import { Label } from '$lib/components/ui/label';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { completeOnboarding } from '$lib/remote/profile.remote';
	import { markOnboardingComplete } from '$lib/remote/subscriptions.remote';
	import {
		calculateBMR,
		calculateCalorieGoal,
		calculateTDEE,
		calculateWaterGoal,
		inchesToCm,
		kgToLbs,
		lbsToKg
	} from '$lib/utils/calculations';
	import { formatDate } from '$lib/utils/format';
	import {
		CalendarDate,
		DateFormatter,
		getLocalTimeZone,
		today,
		type DateValue
	} from '@internationalized/date';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import CheckIcon from '@lucide/svelte/icons/check';
	import FlameIcon from '@lucide/svelte/icons/flame';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import { toast } from 'svelte-sonner';
	import { fly } from 'svelte/transition';

	const df = new DateFormatter('en-US', { dateStyle: 'long' });

	let step = $state(0);
	let units = $state<'imperial' | 'metric'>('imperial');
	let sex = $state<'male' | 'female' | ''>('');
	let birthDateValue = $state<DateValue | undefined>(undefined);
	let height = $state('');
	let heightFeet = $state('');
	let heightInches = $state('');
	let currentWeight = $state('');
	let goalWeight = $state('');
	let activityLevel = $state<'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'>(
		'moderate'
	);
	let saving = $state(false);

	const totalSteps = 5;

	const activityOptions = [
		{ value: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise' },
		{ value: 'light', label: 'Lightly Active', desc: 'Light exercise 1-3 days/week' },
		{ value: 'moderate', label: 'Moderately Active', desc: 'Moderate exercise 3-5 days/week' },
		{ value: 'active', label: 'Very Active', desc: 'Hard exercise 6-7 days/week' },
		{ value: 'very_active', label: 'Extra Active', desc: 'Very hard exercise & physical job' }
	] as const;

	function calculateAgeFromDateValue(birthDate: DateValue | undefined): number {
		if (!birthDate) return 30;
		const todayDate = today(getLocalTimeZone());
		let age = todayDate.year - birthDate.year;
		if (
			todayDate.month < birthDate.month ||
			(todayDate.month === birthDate.month && todayDate.day < birthDate.day)
		) {
			age--;
		}
		return age;
	}

	function getHeightInCm(): number {
		if (units === 'metric') {
			return parseFloat(height) || 0;
		}
		return inchesToCm(parseFloat(heightFeet) || 0, parseFloat(heightInches) || 0);
	}

	function getWeightInKg(weightValue: string): number {
		const w = parseFloat(weightValue) || 0;
		return units === 'metric' ? w : lbsToKg(w);
	}

	function getComputedCalorieGoal(): number {
		const heightCm = getHeightInCm();
		const weightKg = getWeightInKg(currentWeight);
		const age = calculateAgeFromDateValue(birthDateValue);

		const bmr = calculateBMR(heightCm, weightKg, age, sex || null);
		const tdee = calculateTDEE(bmr, activityLevel);

		const current = parseFloat(currentWeight) || 0;
		const goal = parseFloat(goalWeight) || 0;

		return calculateCalorieGoal(tdee, current, goal || null);
	}

	function getComputedWaterGoal(): number {
		const weight = parseFloat(currentWeight) || (units === 'imperial' ? 150 : 70);
		const weightLbs = units === 'imperial' ? weight : kgToLbs(weight);
		return calculateWaterGoal(weightLbs, units);
	}

	let calculatedCalories = $derived(getComputedCalorieGoal());
	let calculatedWater = $derived(getComputedWaterGoal());
	let weightDiff = $derived(() => {
		const current = parseFloat(currentWeight) || 0;
		const goal = parseFloat(goalWeight) || 0;
		return current - goal;
	});

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

	async function handleComplete() {
		saving = true;

		try {
			const heightCm = getHeightInCm();

			await completeOnboarding({
				units,
				height: heightCm,
				calorieGoal: calculatedCalories,
				waterGoal: calculatedWater,
				activityLevel,
				...(sex && { sex }),
				...(birthDateValue && { birthDate: birthDateValue.toString() }),
				...(goalWeight && { weightGoal: parseFloat(goalWeight) }),
				...(currentWeight && {
					currentWeight: parseFloat(currentWeight),
					currentWeightDate: formatDate(new Date())
				})
			});

			await markOnboardingComplete();

			goto(resolve('/'));
		} catch (err) {
			console.error('Failed to complete onboarding:', err);
			toast.error('Failed to save settings');
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Get Started - Calories</title>
	<meta name="description" content="Set up your personalized nutrition goals" />
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex h-full flex-col bg-background">
	<div class="mx-auto flex h-full w-full max-w-md flex-col px-6 py-8 sm:py-12">
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

		<div class="flex min-h-[480px] flex-1 flex-col">
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
							Let's set up your profile to calculate personalized nutrition goals.
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
						<h2 class="text-xl font-bold text-foreground">Basic Information</h2>
					</div>

					<div class="flex-1 space-y-6">
						<div class="space-y-3">
							<Label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
								Units
							</Label>
							<div class="grid grid-cols-2 gap-2">
								<button
									class="relative flex h-12 items-center justify-center rounded-xl font-medium transition-all {units ===
									'imperial'
										? 'bg-foreground text-background'
										: 'bg-muted text-muted-foreground hover:text-foreground'}"
									onclick={() => (units = 'imperial')}
								>
									<span class="text-lg">Imperial</span>
								</button>
								<button
									class="relative flex h-12 items-center justify-center rounded-xl font-medium transition-all {units ===
									'metric'
										? 'bg-foreground text-background'
										: 'bg-muted text-muted-foreground hover:text-foreground'}"
									onclick={() => (units = 'metric')}
								>
									<span class="text-lg">Metric</span>
								</button>
							</div>
							<p class="text-xs text-muted-foreground">
								{units === 'imperial' ? 'lbs, ft/in, oz' : 'kg, cm, ml'}
							</p>
						</div>

						<div class="space-y-3">
							<Label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
								Sex <span class="font-normal">(for calorie calculation)</span>
							</Label>
							<div class="grid grid-cols-2 gap-2">
								<button
									class="relative flex h-12 items-center justify-center rounded-xl font-medium transition-all {sex ===
									'male'
										? 'bg-foreground text-background'
										: 'bg-muted text-muted-foreground hover:text-foreground'}"
									onclick={() => (sex = 'male')}
								>
									Male
								</button>
								<button
									class="relative flex h-12 items-center justify-center rounded-xl font-medium transition-all {sex ===
									'female'
										? 'bg-foreground text-background'
										: 'bg-muted text-muted-foreground hover:text-foreground'}"
									onclick={() => (sex = 'female')}
								>
									Female
								</button>
							</div>
						</div>

						<div class="space-y-2">
							<Label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
								Birth Date <span class="font-normal">(optional)</span>
							</Label>
							<Popover>
								<PopoverTrigger>
									{#snippet child({ props })}
										<Button
											{...props}
											variant="outline"
											class="h-12 w-full justify-start rounded-xl ps-4 text-start font-medium"
										>
											{birthDateValue
												? df.format(birthDateValue.toDate(getLocalTimeZone()))
												: 'Select your birth date'}
											<CalendarIcon class="ms-auto size-4 opacity-50" />
										</Button>
									{/snippet}
								</PopoverTrigger>
								<PopoverContent class="w-auto p-0" side="top">
									<Calendar
										type="single"
										bind:value={birthDateValue}
										captionLayout="dropdown"
										minValue={new CalendarDate(1900, 1, 1)}
										maxValue={today(getLocalTimeZone())}
									/>
								</PopoverContent>
							</Popover>
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
						<h2 class="text-xl font-bold text-foreground">Body Measurements</h2>
					</div>

					<div class="flex-1 space-y-6">
						<div class="space-y-2">
							<Label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
								Height
							</Label>
							{#if units === 'imperial'}
								<div class="flex gap-2">
									<InputGroup class="h-12 flex-1">
										<InputGroupInput
											type="number"
											class="h-full rounded-xl font-medium"
											placeholder="5"
											bind:value={heightFeet}
										/>
										<InputGroupAddon class="rounded-r-2xl">
											<InputGroupText class="text-muted-foreground">ft</InputGroupText>
										</InputGroupAddon>
									</InputGroup>
									<InputGroup class="h-12 flex-1">
										<InputGroupInput
											type="number"
											class="h-full rounded-xl font-medium"
											placeholder="8"
											bind:value={heightInches}
										/>
										<InputGroupAddon class="rounded-r-2xl">
											<InputGroupText class="text-muted-foreground">in</InputGroupText>
										</InputGroupAddon>
									</InputGroup>
								</div>
							{:else}
								<InputGroup class="h-12">
									<InputGroupInput
										type="number"
										class="h-full rounded-xl font-medium"
										placeholder="175"
										bind:value={height}
									/>
									<InputGroupAddon class="rounded-r-2xl">
										<InputGroupText class="text-muted-foreground">cm</InputGroupText>
									</InputGroupAddon>
								</InputGroup>
							{/if}
						</div>

						<div class="space-y-2">
							<Label
								for="currentWeight"
								class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
							>
								Current Weight
							</Label>
							<InputGroup class="h-12">
								<InputGroupInput
									id="currentWeight"
									type="number"
									step="0.1"
									class="h-full rounded-xl font-medium"
									placeholder={units === 'imperial' ? '160' : '73'}
									bind:value={currentWeight}
								/>
								<InputGroupAddon class="rounded-r-2xl">
									<InputGroupText class="text-muted-foreground">
										{units === 'imperial' ? 'lbs' : 'kg'}
									</InputGroupText>
								</InputGroupAddon>
							</InputGroup>
						</div>
					</div>

					<div class="mt-8 flex gap-3">
						<Button variant="ghost" class="h-12 flex-1 rounded-xl font-bold" onclick={prevStep}>
							Back
						</Button>
						<Button
							class="h-12 flex-1 rounded-xl font-bold"
							onclick={nextStep}
							disabled={!currentWeight || (units === 'imperial' ? !heightFeet : !height)}
						>
							Continue
						</Button>
					</div>
				</div>
			{:else if step === 3}
				<div class="flex flex-1 flex-col" in:fly={{ x: 20, duration: 250, delay: 50 }}>
					<div class="mb-6">
						<p class="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
							Step 3
						</p>
						<h2 class="text-xl font-bold text-foreground">Activity Level</h2>
					</div>

					<div class="flex-1 space-y-2">
						{#each activityOptions as option (option.value)}
							<button
								class="flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all {activityLevel ===
								option.value
									? 'border-foreground bg-foreground/5'
									: 'border-border hover:border-foreground/30'}"
								onclick={() => (activityLevel = option.value)}
							>
								<div
									class="flex size-5 items-center justify-center rounded-full border-2 transition-all {activityLevel ===
									option.value
										? 'border-foreground bg-foreground'
										: 'border-muted-foreground'}"
								>
									{#if activityLevel === option.value}
										<CheckIcon class="size-3 text-background" />
									{/if}
								</div>
								<div class="flex-1">
									<p class="font-medium">{option.label}</p>
									<p class="text-xs text-muted-foreground">{option.desc}</p>
								</div>
							</button>
						{/each}
					</div>

					<div class="mt-8 flex gap-3">
						<Button variant="ghost" class="h-12 flex-1 rounded-xl font-bold" onclick={prevStep}>
							Back
						</Button>
						<Button class="h-12 flex-1 rounded-xl font-bold" onclick={nextStep}>Continue</Button>
					</div>
				</div>
			{:else if step === 4}
				<div class="flex flex-1 flex-col" in:fly={{ x: 20, duration: 250, delay: 50 }}>
					<div class="mb-6">
						<p class="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
							Step 4
						</p>
						<h2 class="text-xl font-bold text-foreground">Your Goals</h2>
					</div>

					<div class="flex-1 space-y-5">
						<div class="space-y-2">
							<Label
								for="goalWeight"
								class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
							>
								Goal Weight <span class="font-normal">(optional)</span>
							</Label>
							<InputGroup class="h-12">
								<InputGroupInput
									id="goalWeight"
									type="number"
									step="0.1"
									class="h-full rounded-xl font-medium"
									placeholder={units === 'imperial' ? '150' : '68'}
									bind:value={goalWeight}
								/>
								<InputGroupAddon class="rounded-r-2xl">
									<InputGroupText class="text-muted-foreground">
										{units === 'imperial' ? 'lbs' : 'kg'}
									</InputGroupText>
								</InputGroupAddon>
							</InputGroup>
							{#if goalWeight && weightDiff() !== 0}
								<p class="text-xs text-muted-foreground">
									{weightDiff() > 0 ? 'Lose' : 'Gain'}
									{Math.abs(weightDiff()).toFixed(1)}
									{units === 'imperial' ? 'lbs' : 'kg'}
								</p>
							{/if}
						</div>

						<div
							class="space-y-4 rounded-2xl border border-border/50 bg-muted/30 p-4"
							transition:fly={{ y: 8, duration: 200 }}
						>
							<p class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
								Your Calculated Goals
							</p>
							<div class="grid grid-cols-2 gap-4">
								<div>
									<p class="text-2xl font-bold tabular-nums">{calculatedCalories}</p>
									<p class="text-xs text-muted-foreground">kcal / day</p>
								</div>
								<div>
									<p class="text-2xl font-bold tabular-nums">{calculatedWater}</p>
									<p class="text-xs text-muted-foreground">
										{units === 'imperial' ? 'oz' : 'ml'} water / day
									</p>
								</div>
							</div>
							<p class="text-xs leading-relaxed text-muted-foreground">
								{#if goalWeight && weightDiff() > 0}
									Based on your profile with a moderate deficit for sustainable weight loss (~1
									{units === 'imperial' ? 'lb' : '0.5kg'}/week).
								{:else if goalWeight && weightDiff() < 0}
									Based on your profile with a moderate surplus for healthy weight gain (~1
									{units === 'imperial' ? 'lb' : '0.5kg'}/week).
								{:else}
									Based on your profile for maintaining your current weight.
								{/if}
							</p>
						</div>
					</div>
					<div class="mt-8 flex gap-3">
						<Button variant="ghost" class="h-12 flex-1 rounded-xl font-bold" onclick={prevStep}>
							Back
						</Button>
						<Button
							class="h-12 flex-1 rounded-xl font-bold"
							onclick={handleComplete}
							disabled={saving}
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
