<script lang="ts">
	import { signOut } from '#lib/auth.remote.js';

	let { data } = $props();
</script>

<!-- Everything under (protected) requires a session; see hooks.server.ts. -->
<h1>Account</h1>
<p>{data.user?.name} ({data.user?.email})</p>

<form {...signOut}>
	<button type="submit">Sign out</button>
</form>
