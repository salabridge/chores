<script lang="ts">
	import type { HTMLFieldsetAttributes } from 'svelte/elements';
	import SocialButton, {
		type SocialProvider,
	} from '#lib/components/ui/SocialButton.svelte';

	interface Props extends Omit<HTMLFieldsetAttributes, 'class' | 'children'> {
		/**
		 * Called with the chosen provider, e.g.
		 * `(provider) => authClient.signIn.social({ provider })`.
		 */
		onchoose?: (provider: SocialProvider) => void;
		/**
		 * `submit` makes each button submit its enclosing form with
		 * `provider=<google|apple>`, for a form-action based flow.
		 */
		type?: 'button' | 'submit';
		dividerText?: string;
	}

	let {
		onchoose,
		type = 'button',
		dividerText = 'or continue with',
		'aria-label': ariaLabel = 'Sign in with a social account',
		...rest
	}: Props = $props();

	const providers: SocialProvider[] = ['google', 'apple'];
</script>

<fieldset
	{...rest}
	aria-label={ariaLabel}
	class="m-0 flex min-w-0 flex-col gap-16 border-0 p-0"
>
	<div class="flex items-center gap-12">
		<span aria-hidden="true" class="h-px flex-1 bg-border-subtle"></span>
		<p class="text-[13px] whitespace-nowrap text-text-secondary">
			{dividerText}
		</p>
		<span aria-hidden="true" class="h-px flex-1 bg-border-subtle"></span>
	</div>
	<div class="flex gap-12">
		{#each providers as provider (provider)}
			<SocialButton
				{provider}
				{type}
				name={type === 'submit' ? 'provider' : undefined}
				value={type === 'submit' ? provider : undefined}
				onclick={() => onchoose?.(provider)}
			/>
		{/each}
	</div>
</fieldset>
