<script lang="ts">
	import { signUp } from '#lib/auth.remote.js';

	let { data } = $props();

	// See login/+page.svelte for why the submitted value wins.
	const redirectTo = $derived(
		signUp.fields.redirectTo.value() || data.redirectTo,
	);
</script>

<!-- Bare-bones until the real sign-in UI lands (SB-11). -->
<form {...signUp}>
	<input {...signUp.fields.redirectTo.as('hidden', redirectTo)} />
	<label>
		Name
		<input {...signUp.fields.name.as('text')} autocomplete="name" required />
	</label>
	<label>
		Email
		<input {...signUp.fields.email.as('email')} autocomplete="email" required />
	</label>
	<label>
		Password
		<input
			{...signUp.fields._password.as('password')}
			autocomplete="new-password"
			minlength="8"
			required
		/>
	</label>
	{#each signUp.fields.allIssues() ?? [] as issue}
		<p role="alert">{issue.message}</p>
	{/each}
	<button type="submit">Create account</button>
</form>

<p>Already have an account? <a href="/login">Sign in</a></p>
