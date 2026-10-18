<script lang="ts">
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';

	let {
		email,
		link,
	}: {
		/** Who the link is for. */
		email: string;
		/** The invite link. Only shown once: just its hash is stored. */
		link: string;
	} = $props();

	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(link);
			copied = true;
		} catch {
			// No clipboard access (an insecure origin, or denied): the field
			// stays selectable for a manual copy.
			copied = false;
		}
	}
</script>

<div
	class="flex flex-col gap-8 rounded-xl border border-border-subtle bg-background-base p-12"
	role="status"
>
	<p class="text-[13px] text-text-secondary">
		Send this link to <span class="font-semibold text-text-primary">{email}</span>.
		It works for 7 days, and you won't see it again after you leave this page.
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
			{copied ? 'Copied' : 'Copy link'}
		</SecondaryButton>
	</div>
</div>
