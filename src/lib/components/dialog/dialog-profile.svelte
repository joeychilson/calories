<script lang="ts">
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
	import { getProfile, updateProfile } from '$lib/remote/profile.remote';
	import {
		CalendarDate,
		DateFormatter,
		getLocalTimeZone,
		today,
		type DateValue
	} from '@internationalized/date';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import CheckIcon from '@lucide/svelte/icons/check';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import UserIcon from '@lucide/svelte/icons/user';
	import { toast } from 'svelte-sonner';
	import ResponsiveDialog from './dialog-responsive.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const df = new DateFormatter('en-US', { dateStyle: 'long' });

	const initialProfile = await getProfile();
	const profile = $derived(getProfile().current ?? initialProfile);

	let units = $state<'imperial' | 'metric'>('imperial');
	let sex = $state<'male' | 'female' | ''>('');
	let birthDateValue = $state<DateValue | undefined>(undefined);
	let height = $state('');
	let heightFeet = $state('');
	let heightInches = $state('');
	let activityLevel = $state<'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'>(
		'moderate'
	);
	let saving = $state(false);

	const activityOptions = [
		{ value: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise' },
		{ value: 'light', label: 'Lightly Active', desc: 'Light exercise 1-3 days/week' },
		{ value: 'moderate', label: 'Moderately Active', desc: 'Moderate exercise 3-5 days/week' },
		{ value: 'active', label: 'Very Active', desc: 'Hard exercise 6-7 days/week' },
		{ value: 'very_active', label: 'Extra Active', desc: 'Very hard exercise & physical job' }
	] as const;

	$effect(() => {
		if (open && profile) {
			units = profile.units ?? 'imperial';
			sex = profile.sex ?? '';
			activityLevel = profile.activityLevel ?? 'moderate';

			if (profile.birthDate) {
				try {
					const date = new Date(profile.birthDate);
					birthDateValue = new CalendarDate(
						date.getFullYear(),
						date.getMonth() + 1,
						date.getDate()
					);
				} catch {
					birthDateValue = undefined;
				}
			} else {
				birthDateValue = undefined;
			}

			if (profile.height) {
				if (units === 'metric') {
					height = String(Math.round(profile.height));
				} else {
					const totalInches = profile.height / 2.54;
					heightFeet = String(Math.floor(totalInches / 12));
					heightInches = String(Math.round(totalInches % 12));
				}
			} else {
				height = '';
				heightFeet = '';
				heightInches = '';
			}
		}
	});

	function getHeightInCm(): number {
		if (units === 'metric') {
			return parseFloat(height) || 0;
		}
		const feet = parseFloat(heightFeet) || 0;
		const inches = parseFloat(heightInches) || 0;
		return (feet * 12 + inches) * 2.54;
	}

	async function handleSave() {
		saving = true;

		try {
			const heightCm = getHeightInCm();

			await updateProfile({
				units,
				activityLevel,
				...(sex && { sex: sex as 'male' | 'female' }),
				...(birthDateValue && { birthDate: birthDateValue.toString() }),
				...(heightCm > 0 && { height: heightCm })
			}).updates(getProfile());

			open = false;
		} catch (err) {
			console.error('Failed to save profile:', err);
			toast.error('Failed to save profile');
		} finally {
			saving = false;
		}
	}
</script>

<ResponsiveDialog
	bind:open
	title="Profile"
	subtitle="Update your body measurements"
	contentClass="sm:max-w-md"
>
	{#snippet icon()}
		<UserIcon class="size-5 text-muted-foreground" />
	{/snippet}

	<div class="max-h-[60vh] space-y-6 overflow-y-auto py-4 pr-1">
		<div class="space-y-3">
			<Label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
				Units
			</Label>
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					class="relative flex h-11 items-center justify-center rounded-lg font-medium transition-all {units ===
					'imperial'
						? 'bg-foreground text-background'
						: 'bg-muted text-muted-foreground hover:text-foreground'}"
					onclick={() => (units = 'imperial')}
				>
					Imperial
				</button>
				<button
					type="button"
					class="relative flex h-11 items-center justify-center rounded-lg font-medium transition-all {units ===
					'metric'
						? 'bg-foreground text-background'
						: 'bg-muted text-muted-foreground hover:text-foreground'}"
					onclick={() => (units = 'metric')}
				>
					Metric
				</button>
			</div>
			<p class="text-xs text-muted-foreground">
				{units === 'imperial' ? 'lbs, ft/in, oz' : 'kg, cm, ml'}
			</p>
		</div>

		<div class="space-y-3">
			<Label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
				Sex <span class="font-normal">(for calorie calculation)</span>
			</Label>
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					class="relative flex h-11 items-center justify-center rounded-lg font-medium transition-all {sex ===
					'male'
						? 'bg-foreground text-background'
						: 'bg-muted text-muted-foreground hover:text-foreground'}"
					onclick={() => (sex = 'male')}
				>
					Male
				</button>
				<button
					type="button"
					class="relative flex h-11 items-center justify-center rounded-lg font-medium transition-all {sex ===
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
			<Label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
				Birth Date <span class="font-normal">(optional)</span>
			</Label>
			<Popover>
				<PopoverTrigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="outline"
							class="h-11 w-full justify-start ps-4 text-start font-medium"
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

		<div class="space-y-2">
			<Label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
				Height
			</Label>
			{#if units === 'imperial'}
				<div class="flex gap-2">
					<InputGroup class="flex-1">
						<InputGroupInput type="number" placeholder="5" bind:value={heightFeet} />
						<InputGroupAddon>
							<InputGroupText>ft</InputGroupText>
						</InputGroupAddon>
					</InputGroup>
					<InputGroup class="flex-1">
						<InputGroupInput type="number" placeholder="8" bind:value={heightInches} />
						<InputGroupAddon>
							<InputGroupText>in</InputGroupText>
						</InputGroupAddon>
					</InputGroup>
				</div>
			{:else}
				<InputGroup>
					<InputGroupInput type="number" placeholder="175" bind:value={height} />
					<InputGroupAddon>
						<InputGroupText>cm</InputGroupText>
					</InputGroupAddon>
				</InputGroup>
			{/if}
		</div>

		<div class="space-y-2">
			<Label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
				Activity Level
			</Label>
			<div class="space-y-2">
				{#each activityOptions as option (option.value)}
					<button
						type="button"
						class="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all {activityLevel ===
						option.value
							? 'border-foreground bg-foreground/5'
							: 'border-border hover:border-foreground/30'}"
						onclick={() => (activityLevel = option.value)}
					>
						<div
							class="flex size-4 items-center justify-center rounded-full border-2 transition-all {activityLevel ===
							option.value
								? 'border-foreground bg-foreground'
								: 'border-muted-foreground'}"
						>
							{#if activityLevel === option.value}
								<CheckIcon class="size-2.5 text-background" />
							{/if}
						</div>
						<div class="flex-1">
							<p class="text-sm font-medium">{option.label}</p>
							<p class="text-xs text-muted-foreground">{option.desc}</p>
						</div>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<Button onclick={handleSave} disabled={saving} class="w-full">
		{#if saving}
			<Loader2Icon class="mr-2 size-4 animate-spin" />
			Saving...
		{:else}
			Save Profile
		{/if}
	</Button>
</ResponsiveDialog>
