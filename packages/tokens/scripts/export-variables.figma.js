// Figma Plugin API script that exports the file's local variables in the same
// shape as the REST `GET /v1/files/:key/variables/local` response's `meta`.
//
// It isn't run by Node. Run it in the Figma file through the Figma MCP's
// `use_figma` tool (or as a scratch plugin), then save the returned JSON as
// `figma-variables.json` in this package. See README.md "Updating tokens".
//
// Numbers are rounded to 4 decimals. That's lossless once colorToHex converts
// them to 8-bit channels, and it keeps the output under the MCP's 20KB limit.

const round = (n) => Math.round(n * 1e4) / 1e4;

function roundValue(value) {
	if (typeof value === 'number') return round(value);
	if (value && typeof value === 'object' && 'r' in value) {
		return {
			r: round(value.r),
			g: round(value.g),
			b: round(value.b),
			a: round(value.a),
		};
	}
	return value;
}

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const variables = await figma.variables.getLocalVariablesAsync();

const variableCollections = {};
for (const c of collections) {
	variableCollections[c.id] = {
		id: c.id,
		name: c.name,
		modes: c.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
		defaultModeId: c.defaultModeId,
		variableIds: [...c.variableIds],
	};
}

const vars = {};
for (const v of [...variables].sort((a, b) => a.name.localeCompare(b.name))) {
	const valuesByMode = {};
	for (const [modeId, value] of Object.entries(v.valuesByMode)) {
		valuesByMode[modeId] = roundValue(value);
	}
	vars[v.id] = {
		id: v.id,
		name: v.name,
		variableCollectionId: v.variableCollectionId,
		resolvedType: v.resolvedType,
		valuesByMode,
	};
}

return { variables: vars, variableCollections };
