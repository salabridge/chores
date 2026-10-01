import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInviteToken, hashInviteToken } from './invites.ts';

test('hashInviteToken is lowercase hex SHA-256 (matches the token_hash check)', () => {
	assert.equal(
		hashInviteToken('abc'),
		'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
	);
	assert.match(hashInviteToken('anything'), /^[0-9a-f]{64}$/);
});

test('createInviteToken returns a url-safe token and its hash', () => {
	const a = createInviteToken();
	const b = createInviteToken();
	assert.match(a.token, /^[A-Za-z0-9_-]{43}$/);
	assert.equal(a.tokenHash, hashInviteToken(a.token));
	assert.notEqual(a.token, b.token);
});
