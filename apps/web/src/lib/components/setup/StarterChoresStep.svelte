<script lang="ts">
	import { track } from '#lib/analytics.js';
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import { STARTER_CHORES } from '#lib/setup.js';
	import { finishSetupStep } from '#lib/setup.remote.js';

	let {
		kids,
		onback,
	}: {
		kids: { id: string; displayName: string }[];
		onback?: () => void;
	} = $props();

	const frequencyLabel = {
		daily: 'Daily',
		weekly: 'Weekly',
		weekends: 'Weekends',
	} as const;
	const optionClass =
		'flex items-center gap-12 rounded-xl border border-border-subtle bg-surface-default p-12 has-focus-visible:outline-2 has-focus-visible:outline-border-orange has-checked:border-border-orange has-checked:bg-surface-accent-orange-subtle';
	/** Which button sent the form, for analytics: Skip sends no chores. */
	let skipping = false;
</script>

<form
	{...finishSetupStep.enhance(async (form) => {
		const picked = skipping ? 0 : (finishSetupStep.fields.chores.value()?.length ?? 0);
		const skipped = skipping;
		if (await form.submit()) {
			track('setup_completed', { starter_chores: picked, skipped });
		}
	})}
	class="flex flex-col gap-24"
>
	<FormAlert issues={finishSetupStep.fields.issues()} />

	<fieldset class="flex flex-col gap-8">
		<legend class="pb-8 text-[14px] font-semibold text-text-secondary">
			Pick a few to start with
		</legend>
		{#each STARTER_CHORES as chore (chore.id)}
			<label class={optionClass}>
				<input
					{...finishSetupStep.fields.chores.as('checkbox', chore.id)}
					class="size-[18px] accent-accent-orange"
				/>
				<span class="min-w-0 flex-1">
					<span class="block font-display text-[15px] font-semibold">
						{chore.title}
					</span>
					<span class="block text-[13px] text-text-secondary">
						{frequencyLabel[chore.frequency]}, {chore.points} points
					</span>
				</span>
			</label>
		{/each}
	</fieldset>

	<fieldset class="flex flex-col gap-8">
		<legend class="pb-8 text-[14px] font-semibold text-text-secondary">
			Who gets them?
		</legend>
		{#each kids as kid (kid.id)}
			<label class={optionClass}>
				<input
					{...finishSetupStep.fields.assignees.as('checkbox', kid.id)}
					checked
					class="size-[18px] accent-accent-orange"
				/>
				<span class="font-display text-[15px] font-semibold">
					{kid.displayName}
				</span>
			</label>
		{/each}
		<p class="text-[13px] text-text-secondary">
			Each kid you pick gets their own copy of every chore you choose.
		</p>
	</fieldset>

	<div class="flex flex-col gap-8">
		<PrimaryButton
			type="submit"
			pending={finishSetupStep.pending > 0}
			onclick={() => (skipping = false)}
		>
			Finish setup
		</PrimaryButton>
		<SecondaryButton
			type="submit"
			name="skip"
			value="1"
			formnovalidate
			onclick={() => (skipping = true)}
			disabled={finishSetupStep.pending > 0}
		>
			Skip for now
		</SecondaryButton>
		{#if onback}
			<SecondaryButton onclick={onback}>Back</SecondaryButton>
		{/if}
	</div>
</form>
