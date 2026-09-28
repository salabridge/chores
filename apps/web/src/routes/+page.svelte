<script lang="ts">
	let { data } = $props();
</script>

<p>May the forces I fight never win against my spirit.</p>

{#if data.user}
	<p>Signed in as {data.user.email}. <a href="/account">Account</a></p>
{:else}
	<p><a href="/login">Sign in</a> or <a href="/signup">create an account</a></p>
{/if}

