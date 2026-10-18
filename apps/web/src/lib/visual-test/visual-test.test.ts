import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Chromatic only snapshots each file's "Visual test" story, so a stories file
// without one has no visual coverage at all. Checked from source because the
// story list only exists once Storybook has indexed the files.
const src = join(import.meta.dirname, '..', '..');

function storiesFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return storiesFiles(path);
		return entry.name.endsWith('.stories.svelte') ? [path] : [];
	});
}

const files = storiesFiles(src);

describe('visual-test stories', () => {
	it('finds the stories files', () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it.each(files.map((path) => [relative(src, path), path]))(
		'%s has exactly one Visual test story rendering its own module',
		(_name, path) => {
			const source = readFileSync(path, 'utf8');
			expect(
				source.match(/tags=\{\['visual-test', '!autodocs'\]\}/g),
			).toHaveLength(1);
			expect(source).toMatch(
				/parameters=\{(visualTestParameters|responsiveVisualTestParameters)\}/,
			);
			expect(source).toContain(
				`import * as thisFile from './${basename(path)}';`,
			);
			expect(source).toContain('<VisualTestGrid stories={thisFile}');
		},
	);
});
