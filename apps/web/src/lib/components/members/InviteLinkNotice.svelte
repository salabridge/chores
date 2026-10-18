<script lang="ts">
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';

	let {
		email,
		link,
		emailed = false,
	}: {
		/** Who the link is for. */
		email: string;
		/** The invite link. Only shown once: just its hash is stored. */
		link: string;
		/** Whether the link was also emailed to them. */
		emailed?: boolean;
	} = $props();

	const NOTE =
		"It works for 7 days, and you won't see it again after you leave this page.";

	let status = $state<'idle' | 'copied' | 'failed'>('idle');
	let reset: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		clearTimeout(reset);
		try {
			await navigator.clipboard.writeText(link);
			status = 'copied';
			// Back to "Copy link", so a second copy says something too.
			reset = setTimeout(() => {
				status = 'idle';
			}, 2000);
		} catch {
			// No clipboard access (an insecure origin, or denied). Say so, or the
			// parent pastes whatever was on their clipboard before.
			status = 'failed';
		}
	}
</script>

<div
	class="flex flex-col gap-8 rounded-xl border border-border-subtle bg-background-base p-12"
	role="status"
>
	<p class="text-[13px] text-text-secondary">
		{emailed ? 'We emailed the link to' : 'Send this link to'}
		<span class="font-semibold text-text-primary">{email}</span>. {NOTE}
	</p>
	<div class="flex items-center gap-8">
		<input
			class="min-w-0 flex-1 rounded-[10px] border border-border-subtle bg-surface-default px-12 py-8 text-[13px] text-text-primary"
			readonly
			value={link}
			aria-label={`Invite link for ${email}`}
			onfocus={(e) => e.currentTarget.select()}
		/>
		<SecondaryButton type="button" onclick={copy}>
			{status === 'copied' ? 'Copied' : 'Copy link'}
		</SecondaryButton>
	</div>
	{#if status === 'failed'}
		<p class="text-[13px] text-text-red">
			Couldn't copy. Select the link above and copy it yourself.
		</p>
	{/if}
</div>
