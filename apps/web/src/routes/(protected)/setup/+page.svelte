<script lang="ts">
	import { untrack } from 'svelte';
	import { signOut } from '#lib/auth.remote.js';
	import AuthHeading from '#lib/components/auth/AuthHeading.svelte';
	import AuthShell from '#lib/components/auth/AuthShell.svelte';
	import SetPinForm from '#lib/components/profiles/SetPinForm.svelte';
	import HouseholdStep from '#lib/components/setup/HouseholdStep.svelte';
	import KidsStep from '#lib/components/setup/KidsStep.svelte';
	import ParentStep from '#lib/components/setup/ParentStep.svelte';
	import SetupProgress from '#lib/components/setup/SetupProgress.svelte';
	import StarterChoresStep from '#lib/components/setup/StarterChoresStep.svelte';
	import Logo from '#lib/components/ui/Logo.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import { SETUP_STEPS, type SetupStep } from '#lib/setup.js';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	// Which step is on screen. It starts at the first unfinished one; Continue
	// and Back move it, so adding a second kid doesn't jump ahead on its own.
	let view = $state<SetupStep>(untrack(() => data.step));

	const move = (offset: number) => {
		view = SETUP_STEPS[SETUP_STEPS.indexOf(view) + offset] ?? view;
	};
	const saved = async () => {
		await invalidateAll();
		move(1);
	};

	const titles: Record<SetupStep, { title: string; blurb: string }> = {
		household: {
			title: 'Set up your household',
			blurb: 'Name your household and pick its time zone.',
		},
		parent: {
			title: 'About you',
			blurb: 'How your kids see you, and your avatar.',
		},
		kids: {
			title: 'Add your kids',
			blurb: 'Add everyone who will do chores. You can add more later.',
		},
		pin: {
			title: 'Set a parent PIN',
			blurb:
				'The PIN locks kid profiles, so only you can switch back to the parent view.',
		},
		chores: {
			title: 'Pick some starter chores',
			blurb: 'Optional. Choose a few so Today is not empty on day one.',
		},
	};
</script>

<svelte:head><title>Set up · ChoreLoop</title></svelte:head>

<AuthShell>
	<div class="flex flex-col gap-24 pb-32">
		<Logo />
		<SetupProgress current={view} />
		<AuthHeading title={titles[view].title}>{titles[view].blurb}</AuthHeading>

		{#if view === 'household'}
			<HouseholdStep
				name={data.household?.name}
				timezone={data.household?.timezone}
				onsaved={saved}
			/>
		{:else if view === 'parent'}
			<ParentStep
				displayName={data.parent?.displayName || data.userName}
				avatarInitial={data.parent?.avatarInitial}
				onsaved={saved}
				onback={() => move(-1)}
			/>
		{:else if view === 'kids'}
			<KidsStep
				kids={data.kids}
				onchanged={() => invalidateAll()}
				oncontinue={() => move(1)}
				onback={() => move(-1)}
			/>
		{:else if view === 'pin'}
			{#if data.progress.hasPin}
				<p class="text-[15px] text-text-secondary">
					Your PIN is set. You can change it later from the profile picker.
				</p>
				<div class="flex flex-col gap-8">
					<PrimaryButton onclick={() => move(1)}>Continue</PrimaryButton>
					<SecondaryButton onclick={() => move(-1)}>Back</SecondaryButton>
				</div>
			{:else}
				<SetPinForm
					onsaved={async () => {
						await invalidateAll();
						move(1);
					}}
				/>
				<SecondaryButton onclick={() => move(-1)}>Back</SecondaryButton>
			{/if}
		{:else}
			<StarterChoresStep kids={data.kids} onback={() => move(-1)} />
		{/if}

		<form {...signOut} class="pt-8 text-center">
			<button
				type="submit"
				disabled={signOut.pending > 0}
				class="text-[14px] font-semibold text-text-secondary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange disabled:opacity-60"
			>
				Sign out
			</button>
		</form>
	</div>
</AuthShell>
