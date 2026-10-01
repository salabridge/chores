<script lang="ts">
	import AuthHeading from '#lib/components/auth/AuthHeading.svelte';
	import AuthShell from '#lib/components/auth/AuthShell.svelte';
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import SetPinForm from '#lib/components/profiles/SetPinForm.svelte';
	import Callout from '#lib/components/ui/Callout.svelte';
	import Logo from '#lib/components/ui/Logo.svelte';
	import MemberAvatar from '#lib/components/ui/MemberAvatar.svelte';
	import { selectProfile } from '#lib/profiles.remote.js';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	const tile =
		'flex w-full items-center gap-16 rounded-[16px] border border-border-subtle bg-surface-default p-16 text-left font-display text-[17px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange disabled:opacity-60';
</script>

<svelte:head><title>Who's using ChoreLoop? · ChoreLoop</title></svelte:head>

<AuthShell>
	<div class="flex flex-col gap-32">
		<Logo />
		<AuthHeading title="Who's using ChoreLoop?">
			Pick a profile. Leaving a kid's profile takes your parent PIN.
		</AuthHeading>

		{#if !data.hasPin}
			<Callout tone="action" title="Set a parent PIN first">
				Kids open their own profile on this device, and your PIN is what lets
				you back out. Choose one to unlock their profiles.
				<div class="pt-16">
					<SetPinForm onsaved={() => invalidateAll()} />
				</div>
			</Callout>
		{/if}

		<form {...selectProfile} class="flex flex-col gap-12">
			<FormAlert issues={selectProfile.fields.issues()} />
			<!-- biome-ignore lint/a11y/useButtonType: the type comes from the spread -->
			<button
				{...selectProfile.fields.memberId.as('submit', data.parent.id)}
				class={tile}
			>
				<MemberAvatar name={data.parent.name} size="lg" />
				<span>{data.parent.name} <span class="text-text-secondary">(parent)</span></span>
			</button>
			{#each data.kids as kid (kid.id)}
				<!-- biome-ignore lint/a11y/useButtonType: the type comes from the spread -->
				<button
					{...selectProfile.fields.memberId.as('submit', kid.id)}
					class={tile}
					disabled={!data.hasPin}
				>
					<MemberAvatar name={kid.name} size="lg" tone="blue" />
					<span>{kid.name}</span>
				</button>
			{/each}
		</form>
	</div>
</AuthShell>
