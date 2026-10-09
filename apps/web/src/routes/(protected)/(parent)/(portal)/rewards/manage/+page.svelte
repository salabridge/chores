<script lang="ts">
	import { isHttpError } from '@sveltejs/kit';
	import WorkspaceHeader from '#lib/components/shell/WorkspaceHeader.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Callout from '#lib/components/ui/Callout.svelte';
	import ChoiceChips from '#lib/components/ui/ChoiceChips.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import ProgressBar from '#lib/components/ui/ProgressBar.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import SurfaceCard from '#lib/components/ui/SurfaceCard.svelte';
	import Textarea from '#lib/components/ui/Textarea.svelte';
	import TextInput from '#lib/components/ui/TextInput.svelte';
	import Toggle from '#lib/components/ui/Toggle.svelte';
	import {
		costLabel,
		emptyRewardDraft,
		hasErrors,
		MAX_DESCRIPTION_LENGTH,
		MAX_TITLE_LENGTH,
		milestoneRemaining,
		type RewardDraft,
		type RewardKind,
		toRewardInput,
		validateRewardDraft,
	} from '#lib/rewards.js';
	import { createReward, deleteReward, updateReward } from '#lib/rewards.remote.js';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let draft = $state<RewardDraft>(emptyRewardDraft());
	// The reward being edited, or null when the form adds a new one.
	let editingId = $state<string | null>(null);
	let showErrors = $state(false);
	let submitting = $state(false);
	let submitError = $state<string | null>(null);

	const errors = $derived(validateRewardDraft(draft));
	const shown = $derived(showErrors ? errors : {});
	const progressById = $derived(new Map(data.milestones.map((m) => [m.id, m])));

	const issue = (message: string | undefined) =>
		message ? [{ message }] : undefined;

	const messageOf = (e: unknown, fallback: string) =>
		isHttpError(e) && e.body.message ? e.body.message : fallback;

	function reset() {
		draft = emptyRewardDraft();
		editingId = null;
		showErrors = false;
		submitError = null;
	}

	function edit(reward: (typeof data.rewards)[number]) {
		editingId = reward.id;
		draft = {
			title: reward.title,
			description: reward.description ?? '',
			costPoints: String(reward.costPoints),
			kind: reward.kind,
			repeatable: reward.repeatable,
		};
		showErrors = false;
		submitError = null;
	}

	async function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		showErrors = true;
		submitError = null;
		if (hasErrors(errors)) return;
		submitting = true;
		try {
			const reward = toRewardInput(draft);
			if (editingId) await updateReward({ id: editingId, reward });
			else await createReward(reward);
			reset();
			await invalidateAll();
		} catch (e) {
			submitError = messageOf(e, 'Could not save this reward. Try again.');
		} finally {
			submitting = false;
		}
	}

	async function remove(id: string) {
		submitError = null;
		try {
			await deleteReward({ id });
			if (editingId === id) reset();
			await invalidateAll();
		} catch (e) {
			submitError = messageOf(e, 'Could not delete this reward. Try again.');
		}
	}
</script>

<svelte:head><title>Rewards · ChoreLoop</title></svelte:head>

<WorkspaceHeader
	title="Rewards"
	subtitle="Set up what kids can spend their points on, and the family milestones the whole household works toward each week."
/>

<div class="grid items-start gap-24 xl:grid-cols-[minmax(0,1fr)_380px]">
	<div class="flex min-w-0 flex-col gap-16">
		{#each data.rewards as reward (reward.id)}
			{@const progress = progressById.get(reward.id)}
			<SurfaceCard title={reward.title} subtitle={reward.description ?? undefined}>
				{#snippet badge()}
					<Badge tone={reward.kind === 'family_milestone' ? 'shared' : 'personal'}>
						{reward.kind === 'family_milestone' ? 'Family Milestone' : 'Personal'}
					</Badge>
				{/snippet}
				<div class="flex flex-col gap-12">
					<p class="text-[14px] text-text-secondary">
						{costLabel(reward)}{reward.repeatable ? ' • Repeatable' : ''}
					</p>
					{#if progress}
						<ProgressBar
							variant="blue"
							value={progress.current}
							max={progress.target}
							label="This week"
							valueLabel="{progress.current} / {progress.target}"
						/>
						<p class="text-[13px] text-text-secondary">
							{milestoneRemaining(progress.remaining, data.week.loopsCompleted)}
						</p>
					{/if}
					<div class="flex gap-8">
						<SecondaryButton type="button" onclick={() => edit(reward)}>Edit</SecondaryButton>
						<SecondaryButton type="button" onclick={() => remove(reward.id)}>Delete</SecondaryButton>
					</div>
				</div>
			</SurfaceCard>
		{:else}
			<Callout tone="info" title="No rewards yet">
				Add a personal reward like "30 Min Screen Time", or a family milestone like "Sundaes on
				Sunday", and it will show up here.
			</Callout>
		{/each}
	</div>

	<form
		{onsubmit}
		novalidate
		aria-label={editingId ? 'Edit reward' : 'New reward'}
		class="flex min-w-0 flex-col gap-16 rounded-[16px] border border-border-subtle bg-surface-default p-24"
	>
		<h2 class="font-display text-[18px] font-bold text-text-primary">
			{editingId ? 'Edit Reward' : 'New Reward'}
		</h2>
		<TextInput
			label="Title"
			placeholder="30 Min Screen Time"
			maxlength={MAX_TITLE_LENGTH + 20}
			autocomplete="off"
			value={draft.title}
			oninput={(e) => (draft.title = e.currentTarget.value)}
			aria-invalid={shown.title ? true : undefined}
			issues={issue(shown.title)}
		/>
		<Textarea
			label="Description"
			maxlength={MAX_DESCRIPTION_LENGTH + 100}
			bind:value={draft.description}
			issues={issue(shown.description)}
		/>
		<ChoiceChips
			label="Kind"
			options={[
				{ value: 'personal', label: 'Personal Reward' },
				{ value: 'family_milestone', label: 'Family Milestone' },
			]}
			bind:value={() => draft.kind, (v) => (draft.kind = v as RewardKind)}
		/>
		<TextInput
			label={draft.kind === 'family_milestone' ? 'Household points to unlock' : 'Cost in points'}
			type="number"
			min="1"
			inputmode="numeric"
			value={draft.costPoints}
			oninput={(e) => (draft.costPoints = e.currentTarget.value)}
			aria-invalid={shown.costPoints ? true : undefined}
			issues={issue(shown.costPoints)}
			hint={draft.kind === 'family_milestone'
				? 'Unlocks once the household has earned this many points in a week.'
				: undefined}
		/>
		{#if draft.kind === 'personal'}
			<div class="flex items-center justify-between gap-12 text-[14px] text-text-secondary">
				<span id="repeatable-label">Can be claimed more than once</span>
				<Toggle bind:checked={draft.repeatable} aria-labelledby="repeatable-label" />
			</div>
		{/if}
		{#if submitError}
			<Callout tone="warning">{submitError}</Callout>
		{/if}
		<div class="flex gap-8">
			<PrimaryButton type="submit" pending={submitting}>
				{editingId ? 'Save Reward' : 'Add Reward'}
			</PrimaryButton>
			{#if editingId}
				<SecondaryButton type="button" onclick={reset}>Cancel</SecondaryButton>
			{/if}
		</div>
	</form>
</div>
