import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { fsExists } from './fs-exists.ts';
import { readJsonFile } from './read-json-file.ts';
import { readPackageJson } from './read-package-json.ts';
import { loadConfig } from './load-config.ts';

const registryDirectory = path.join(os.homedir(), '.globalink');
const registryPath = path.join(registryDirectory, 'registry.json');

type Registry = Record<string, string>;

export const loadRegistry = async (): Promise<Registry> => {
	if (!(await fsExists(registryPath))) {
		return {};
	}

	try {
		return await readJsonFile(registryPath) as Registry;
	} catch (error) {
		throw new Error(`Failed to parse registry ${registryPath}: ${(error as Error).message}`);
	}
};

const saveRegistry = async (registry: Registry) => {
	await fs.mkdir(registryDirectory, { recursive: true });
	await fs.writeFile(registryPath, `${JSON.stringify(registry, null, '\t')}\n`);
};

/**
 * Register the package at `packagePath` in the global registry under both its
 * package.json name and its config alias (when present), each mapped to its
 * absolute path. This is the `npm link` register step that lets other projects
 * depend on it by name or alias.
 */
export const registerPackage = async (
	packagePath: string,
) => {
	const absolutePath = path.resolve(packagePath);

	const keys: string[] = [];
	try {
		const { name } = await readPackageJson(absolutePath);
		keys.push(name);
	} catch { }
	const config = await loadConfig(absolutePath);
	if (config?.alias) {
		keys.push(config.alias);
	}

	if (keys.length === 0) {
		return;
	}

	const registry = await loadRegistry();
	for (const key of keys) {
		registry[key] = absolutePath;
	}
	await saveRegistry(registry);
};

const looksLikePath = (dependency: string) => (
	path.isAbsolute(dependency)
	|| dependency.startsWith('./')
	|| dependency.startsWith('../')
);

/**
 * Resolve a dependency string to an absolute package path. A dependency may be
 * an absolute path, a relative path, or an alias / package name looked up in the
 * global registry. Returns undefined when it cannot be resolved.
 */
export const resolveDependency = async (
	basePackagePath: string,
	dependency: string,
): Promise<string | undefined> => {
	if (looksLikePath(dependency)) {
		return path.resolve(basePackagePath, dependency);
	}

	// A bare string may still be a directory relative to the base package.
	const relativeCandidate = path.resolve(basePackagePath, dependency);
	if (await fsExists(relativeCandidate)) {
		return relativeCandidate;
	}

	const registry = await loadRegistry();
	return registry[dependency];
};