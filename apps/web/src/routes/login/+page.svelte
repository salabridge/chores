<script lang="ts">
	import { signIn } from '#lib/auth.remote.js';

	let { data } = $props();

	// After a no-JS submit the page re-renders at the form's action URL, which
	// drops ?redirectTo, so prefer the value that was just submitted.
	const redirectTo = $derived(
		signIn.fields.redirectTo.value() || data.redirectTo,
	);
</script>

<!-- Bare-bones until the real sign-in UI lands (SB-11). -->
<form {...signIn}>
	<input {...signIn.fields.redirectTo.as('hidden', redirectTo)} />
	<label>
		Email
		<input {...signIn.fields.email.as('email')} autocomplete="email" required />
	</label>
	<label>
		Password
		<input
			{...signIn.fields._password.as('password')}
			autocomplete="current-password"
			required
		/>
	</label>
	{#each signIn.fields.allIssues() ?? [] as issue}
		<p role="alert">{issue.message}</p>
	{/each}
	<button type="submit">Sign in</button>
</form>

<p><a href="/login/code">Email me a sign-in code instead</a></p>
<p>New here? <a href="/signup">Create an account</a></p>
