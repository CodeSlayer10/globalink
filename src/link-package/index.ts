import path from 'path';
import {
	green, red, cyan, magenta,
} from 'kolorist';
import { fsExists } from '../utils/fs-exists.ts';
import type { LinkConfig } from '../types.ts';
import { loadConfig } from '../utils/load-config.ts';
import { resolveDependency } from '../utils/registry.ts';
import { resolveDependencies } from '../utils/filter-config-packages.ts';
import { symlinkPackage } from './symlink-package.ts';

type LinkOptions = {
	include?: string[];
	exclude?: string[];
};

const symlinkOne = async (
	basePackagePath: string,
	absolutePath: string,
	label: string,
): Promise<boolean> => {
	if (!(await fsExists(absolutePath))) {
		console.warn(red('✖'), `Package path does not exist: ${label}`);
		process.exitCode = 1;
		return false;
	}

	try {
		const link = await symlinkPackage(basePackagePath, absolutePath);
		console.log(green('✔'), `Symlinked ${magenta(link.name)}:`, cyan(link.path), '→', cyan(link.target));
		return true;
	} catch (error) {
		console.warn(red('✖'), 'Failed to symlink', cyan(label), 'with error:', (error as Error).message);
		process.exitCode = 1;
		return false;
	}
};

/**
 * Resolve a single dependency (alias, package name, or path) and symlink it into
 * `basePackagePath`'s node_modules.
 */
export const linkPackage = async (
	basePackagePath: string,
	dependency: string,
) => {
	const absolutePath = await resolveDependency(basePackagePath, dependency);

	if (!absolutePath) {
		console.warn(red('✖'), `Could not resolve dependency: ${dependency}`);
		process.exitCode = 1;
		return;
	}

	await symlinkOne(basePackagePath, absolutePath, dependency);
};

/**
 * Link a package's config dependencies into its node_modules. When `recursive`,
 * descend into each dependency's own config and link its dependencies too,
 * stopping at a `deepLink: false` config or an already-visited package.
 */
export const linkFromConfig = async (
	basePackagePath: string,
	config: LinkConfig,
	options: LinkOptions,
	recursive: boolean,
	visited: Set<string> = new Set(),
) => {
	if (!config.dependencies) {
		return;
	}

	const resolvedBase = path.resolve(basePackagePath);
	if (visited.has(resolvedBase)) {
		return;
	}
	visited.add(resolvedBase);

	const dependencies = await resolveDependencies(
		basePackagePath,
		config.dependencies,
		options,
	);

	await Promise.all(
		dependencies.map(async ({ dependency, absolutePath }) => {
			const linked = await symlinkOne(basePackagePath, absolutePath, dependency);

			if (!linked || !recursive) {
				return;
			}

			const depConfig = await loadConfig(absolutePath);
			if (!depConfig || depConfig.deepLink === false) {
				return;
			}

			await linkFromConfig(absolutePath, depConfig, options, recursive, visited);
		}),
	);
};
