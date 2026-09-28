<script lang='ts'>
  import { authClient } from '#lib/client.js';

  const session = authClient.useSession();
  let email = $state('');
  let otp = $state('');
</script>

May the forces I fight never win against my spirit.

<form onsubmit={async (e) => {
  e.preventDefault();
  const { error } = await authClient.emailOtp.verifyEmail({ email, otp });
  if (error) console.error(error);
}}>
  <input type="email" bind:value={email} placeholder="email">
  <input type="text" bind:value={otp} placeholder="code">
  <button type="submit">Submit</button>
</form>

<pre>{JSON.stringify($session)}</pre>