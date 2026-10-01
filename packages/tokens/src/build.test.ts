import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FigmaLocalVariablesResponse } from './figma.ts';

const writeFileMock = vi.fn();
const mkdirMock = vi.fn();
const readFileMock = vi.fn();

vi.mock('node:fs/promises', () => ({
	writeFile: (...args: unknown[]) => writeFileMock(...args),
	mkdir: (...args: unknown[]) => mkdirMock(...args),
	readFile: (...args: unknown[]) => readFileMock(...args),
}));

const fetchLocalVariablesMock = vi.fn();

vi.mock('./figma.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./figma.ts')>();
	return {
		...actual,
		fetchLocalVariables: (...args: [string, string]) =>
			fetchLocalVariablesMock(...args),
	};
});

const { buildCss, buildTailwindTheme, extractTokens, main } = await import(
	'./build.ts'
);

const meta: FigmaLocalVariablesResponse['meta'] = {
	variableCollections: {
		collectionColors: {
			id: 'collectionColors',
			name: 'Colors',
			modes: [
				{ modeId: 'modeLight', name: 'Light' },
				{ modeId: 'modeDark', name: 'Dark' },
			],
			defaultModeId: 'modeLight',
			variableIds: ['varTextPrimary', 'varSurfaceAccent'],
		},
		collectionSpacing: {
			id: 'collectionSpacing',
			name: 'Spacing',
			modes: [{ modeId: 'modeValue', name: 'Value' }],
			defaultModeId: 'modeValue',
			variableIds: ['varSpacingSmall'],
		},
	},
	variables: {
		varTextPrimary: {
			id: 'varTextPrimary',
			name: 'color/text/primary',
			variableCollectionId: 'collectionColors',
			resolvedType: 'COLOR',
			valuesByMode: {
				modeLight: { r: 1, g: 1, b: 1, a: 1 },
				modeDark: { r: 0, g: 0, b: 0, a: 1 },
			},
		},
		// Aliases the light value from another variable, to exercise alias resolution.
		varSurfaceAccent: {
			id: 'varSurfaceAccent',
			name: 'color/surface/accent',
			variableCollectionId: 'collectionColors',
			resolvedType: 'COLOR',
			valuesByMode: {
				modeLight: { type: 'VARIABLE_ALIAS', id: 'varTextPrimary' },
				modeDark: { r: 0.2, g: 0.4, b: 0.6, a: 1 },
			},
		},
		varSpacingSmall: {
			id: 'varSpacingSmall',
			name: 'spacing/small',
			variableCollectionId: 'collectionSpacing',
			resolvedType: 'FLOAT',
			valuesByMode: { modeValue: 4 },
		},
	},
};

describe('extractTokens', () => {
	it('resolves colors (including aliases) and spacing from Figma variables', () => {
		const { colors, spacing } = extractTokens(meta);

		expect(colors).toEqual({
			'color-text-primary': { light: '#ffffff', dark: '#000000' },
			'color-surface-accent': { light: '#ffffff', dark: '#336699' },
		});
		expect(spacing).toEqual({ 'spacing-small': 4 });
	});
});

describe('buildCss / buildTailwindTheme', () => {
	it('emits light/dark/data-theme blocks and matching tailwind theme vars', () => {
		const { colors, spacing } = extractTokens(meta);
		const css = buildCss('fileKey123', colors, spacing);
		const tailwind = buildTailwindTheme(
			Object.keys(colors),
			Object.keys(spacing),
		);

		expect(css).toContain(':root {');
		expect(css).toContain('--color-text-primary: #ffffff;');
		expect(css).toContain('--spacing-small: 4px;');
		expect(css).toContain('@media (prefers-color-scheme: dark)');
		expect(css).toContain('--color-text-primary: #000000;');
		expect(css).toContain(':root[data-theme="dark"]');
		expect(css).toContain(':root[data-theme="light"]');

		expect(tailwind).toContain('@import "./tokens.css";');
		expect(tailwind).toContain(
			'--color-text-primary: var(--color-text-primary);',
		);
		expect(tailwind).toContain('--spacing-small: var(--spacing-small);');
	});
});

describe('main', () => {
	beforeEach(() => {
		process.env.FIGMA_API_TOKEN = 'test-token';
		fetchLocalVariablesMock.mockResolvedValue({
			status: 200,
			error: false,
			meta,
		});
	});

	afterEach(() => {
		delete process.env.FIGMA_API_TOKEN;
		delete process.env.FIGMA_FILE_KEY;
		vi.clearAllMocks();
	});

	it('builds from the figma-variables.json snapshot when FIGMA_API_TOKEN is not set', async () => {
		delete process.env.FIGMA_API_TOKEN;
		readFileMock.mockResolvedValue(JSON.stringify(meta));

		await main();

		expect(fetchLocalVariablesMock).not.toHaveBeenCalled();
		expect(readFileMock).toHaveBeenCalledWith(
			expect.stringMatching(/figma-variables\.json$/),
			'utf8',
		);
		const [, tokensContent] = writeFileMock.mock.calls[0] as [string, string];
		expect(tokensContent).toContain('--color-surface-accent: #336699;');
		expect(tokensContent).toContain('figma-variables.json');
	});

	it('throws when FIGMA_API_TOKEN is not set and the snapshot is missing', async () => {
		delete process.env.FIGMA_API_TOKEN;
		readFileMock.mockRejectedValue(new Error('ENOENT'));

		await expect(main()).rejects.toThrow(/figma-variables\.json/);
		expect(writeFileMock).not.toHaveBeenCalled();
	});

	it('prefers the live REST API over the snapshot when FIGMA_API_TOKEN is set', async () => {
		await main();

		expect(readFileMock).not.toHaveBeenCalled();
		const [, tokensContent] = writeFileMock.mock.calls[0] as [string, string];
		expect(tokensContent).toContain('Pulled live from Figma');
	});

	it('writes generated tokens.css and tailwind.css from the fetched Figma variables', async () => {
		await main();

		expect(mkdirMock).toHaveBeenCalledWith(expect.stringMatching(/dist$/), {
			recursive: true,
		});
		expect(writeFileMock).toHaveBeenCalledTimes(2);

		const [tokensCallArgs, tailwindCallArgs] = writeFileMock.mock.calls as [
			string,
			string,
		][][];
		const [tokensPath, tokensContent] = tokensCallArgs;
		const [tailwindPath, tailwindContent] = tailwindCallArgs;

		expect(tokensPath).toMatch(/tokens\.css$/);
		expect(tailwindPath).toMatch(/tailwind\.css$/);

		expect(tokensContent).toContain('--color-text-primary: #ffffff;');
		expect(tokensContent).toContain('--color-surface-accent: #336699;');
		expect(tokensContent).toContain('--spacing-small: 4px;');

		expect(tailwindContent).toContain(
			'--color-surface-accent: var(--color-surface-accent);',
		);
		expect(tailwindContent).toContain('--spacing-small: var(--spacing-small);');
	});

	it('fetches with FIGMA_FILE_KEY when set, falling back to the default file key otherwise', async () => {
		await main();
		expect(fetchLocalVariablesMock).toHaveBeenCalledWith(
			expect.stringMatching(/^\w+$/),
			'test-token',
		);

		fetchLocalVariablesMock.mockClear();
		process.env.FIGMA_FILE_KEY = 'customFileKey';
		await main();
		expect(fetchLocalVariablesMock).toHaveBeenCalledWith(
			'customFileKey',
			'test-token',
		);
	});
});
