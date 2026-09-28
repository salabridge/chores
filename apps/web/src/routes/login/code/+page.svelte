<script lang="ts">
	import { sendSignInCode } from '#lib/auth.remote.js';

	let { data } = $props();

	// See login/+page.svelte for why the submitted value wins.
	const redirectTo = $derived(
		sendSignInCode.fields.redirectTo.value() || data.redirectTo,
	);
</script>

<!-- Bare-bones until the real sign-in UI lands (SB-11). -->
<form {...sendSignInCode}>
	<input {...sendSignInCode.fields.redirectTo.as('hidden', redirectTo)} />
	<label>
		Email
		<input
			{...sendSignInCode.fields.email.as('email')}
			autocomplete="email"
			required
		/>
	</label>
	{#each sendSignInCode.fields.allIssues() ?? [] as issue}
		<p role="alert">{issue.message}</p>
	{/each}
	<button type="submit">Email me a code</button>
</form>

<p><a href="/login">Sign in with a password instead</a></p>
