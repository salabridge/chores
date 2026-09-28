<script lang="ts">
	import { resendCode, verifyCode } from '#lib/auth.remote.js';

	let { data } = $props();

	// See login/+page.svelte for why the submitted value wins.
	const redirectTo = $derived(
		verifyCode.fields.redirectTo.value() || data.redirectTo,
	);
</script>

<!-- Bare-bones until the real sign-in UI lands (SB-11). -->
<p>
	{data.purpose === 'sign-in'
		? 'We emailed a sign-in code to'
		: 'To finish signing up, enter the code we emailed to'}
	{data.email}.
</p>

<form {...verifyCode}>
	<input {...verifyCode.fields.redirectTo.as('hidden', redirectTo)} />
	<label>
		Code
		<input
			{...verifyCode.fields.otp.as('text')}
			autocomplete="one-time-code"
			inputmode="numeric"
			required
		/>
	</label>
	{#each verifyCode.fields.allIssues() ?? [] as issue}
		<p role="alert">{issue.message}</p>
	{/each}
	<button type="submit">Continue</button>
</form>

<form {...resendCode}>
	{#if resendCode.result?.sent}
		<p role="status">Sent a new code.</p>
	{/if}
	{#each resendCode.fields.allIssues() ?? [] as issue}
		<p role="alert">{issue.message}</p>
	{/each}
	<button type="submit">Send a new code</button>
</form>
