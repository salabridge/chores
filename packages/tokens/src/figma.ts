/**
 * Minimal client for the Figma REST "local variables" endpoint.
 * https://developers.figma.com/docs/rest-api/variables/
 *
 * Requires an Enterprise-org personal access token with the
 * `file_variables:read` scope, passed as FIGMA_API_TOKEN.
 */

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaVariableAlias {
  type: "VARIABLE_ALIAS";
  id: string;
}

export type FigmaVariableValue = FigmaColor | FigmaVariableAlias | number | string | boolean;

export interface FigmaVariable {
  id: string;
  name: string;
  variableCollectionId: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  valuesByMode: Record<string, FigmaVariableValue>;
}

export interface FigmaVariableMode {
  modeId: string;
  name: string;
}

export interface FigmaVariableCollection {
  id: string;
  name: string;
  modes: FigmaVariableMode[];
  defaultModeId: string;
  variableIds: string[];
}

export interface FigmaLocalVariablesResponse {
  status: number;
  error: boolean;
  meta: {
    variables: Record<string, FigmaVariable>;
    variableCollections: Record<string, FigmaVariableCollection>;
  };
}

export async function fetchLocalVariables(
  fileKey: string,
  token: string,
): Promise<FigmaLocalVariablesResponse> {
  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/variables/local`, {
    headers: { "X-Figma-Token": token },
  });

  const body = (await res.json()) as FigmaLocalVariablesResponse & { message?: string };

  if (!res.ok || body.error) {
    throw new Error(
      `Figma variables request failed (${res.status}): ${body.message ?? "unknown error"}. ` +
        "The local-variables endpoint requires an Enterprise-org personal access token with the file_variables:read scope.",
    );
  }

  return body;
}

function isAlias(value: FigmaVariableValue): value is FigmaVariableAlias {
  return typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS";
}

/**
 * Resolves a variable's value for a given mode *name* (e.g. "Light"), following
 * VARIABLE_ALIAS chains across collections. Alias targets are looked up by mode
 * name rather than mode id, since mode ids are only meaningful within their own
 * collection. Falls back to the target collection's default mode when it has no
 * mode of that name (e.g. a single-mode spacing collection).
 */
export function resolveVariableValue(
  variable: FigmaVariable,
  modeName: string,
  variables: Record<string, FigmaVariable>,
  collections: Record<string, FigmaVariableCollection>,
  depth = 0,
): FigmaVariableValue {
  if (depth > 10) {
    throw new Error(`Alias cycle detected while resolving "${variable.name}"`);
  }

  const collection = collections[variable.variableCollectionId];
  const mode = collection.modes.find((m) => m.name.toLowerCase() === modeName.toLowerCase());
  const modeId = mode?.modeId ?? collection.defaultModeId;
  const raw = variable.valuesByMode[modeId] ?? variable.valuesByMode[collection.defaultModeId];

  if (isAlias(raw)) {
    const target = variables[raw.id];
    if (!target) {
      throw new Error(`"${variable.name}" aliases missing variable ${raw.id}`);
    }
    return resolveVariableValue(target, modeName, variables, collections, depth + 1);
  }

  return raw;
}

export function colorToHex(color: FigmaColor): string {
  const channel = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  const hex = `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
  return color.a < 1 ? `${hex}${channel(color.a)}` : hex;
}

export function cssName(figmaName: string): string {
  return figmaName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
