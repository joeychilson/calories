<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { client } from '$lib/auth';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import { toast } from 'svelte-sonner';

	import ResponsiveDialog from './dialog-responsive.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let isDeleting = $state(false);
	let deleteConfirmText = $state('');

	const DELETE_CONFIRMATION = 'delete my account';

	async function handleDeleteAccount() {
		if (deleteConfirmText !== DELETE_CONFIRMATION) return;

		isDeleting = true;
		try {
			await client.deleteUser();
			goto(resolve('/'));
		} catch (error) {
			toast.error('Failed to delete account');
			console.error('Delete account error:', error);
			isDeleting = false;
		}
	}

	function handleCancel() {
		deleteConfirmText = '';
		open = false;
	}
</script>

<ResponsiveDialog
	bind:open
	title="Delete Account"
	subtitle="This will permanently delete your account and all associated data"
	contentClass="max-w-md"
	iconContainerClass="bg-destructive/15 text-destructive border-destructive/20 flex size-9 items-center justify-center rounded-md border"
>
	{#snippet icon()}
		<AlertTriangleIcon class="size-4" />
	{/snippet}

	<div class="space-y-4 py-4">
		<div class="space-y-2">
			<Label for="delete-confirm" class="text-xs">
				Type <code class="bg-muted/60 border-border/40 rounded border px-1 py-0.5 font-mono text-xs"
					>{DELETE_CONFIRMATION}</code
				> to confirm
			</Label>
			<Input
				id="delete-confirm"
				type="text"
				placeholder={DELETE_CONFIRMATION}
				bind:value={deleteConfirmText}
				disabled={isDeleting}
				class="font-mono text-sm"
			/>
		</div>
	</div>

	<div class="flex gap-2 pt-4">
		<Button variant="outline" onclick={handleCancel} disabled={isDeleting} class="flex-1">
			Cancel
		</Button>
		<Button
			variant="destructive"
			onclick={handleDeleteAccount}
			disabled={isDeleting || deleteConfirmText !== DELETE_CONFIRMATION}
			class="flex-1"
		>
			<TrashIcon class="size-4" />
			{isDeleting ? 'Deleting...' : 'Delete Account'}
		</Button>
	</div>
</ResponsiveDialog>
