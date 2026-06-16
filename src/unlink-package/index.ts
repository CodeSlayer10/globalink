import path from 'path';
import {
	green, red, yellow, cyan, magenta,
} from 'kolorist';
import { fsExists } from '../utils/fs-exists.ts';
import type { LinkConfig } from '../types.ts';
import { loadConfig } from '../utils/load-config.ts';
import { resolveDependency } from '../utils/registry.ts';
import { resolveDependencies } from '../utils/filter-config-packages.ts';
import { unsymlinkPackage } from './unsymlink-package.ts';

type UnlinkOptions = {
	include?: string[];
	exclude?: string[];
};

const unsymlinkOne = async (
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
		const link = await unsymlinkPackage(basePackagePath, absolutePath);

		if (link.skippedNonSymlink) {
			console.warn(yellow('⚠'), `Skipped ${magenta(link.name)}: not a symlink`, cyan(link.path));
		} else {
			console.log(green('✔'), `Unlinked ${magenta(link.name)}:`, cyan(link.path));
		}
		return true;
	} catch (error) {
		console.warn(red('✖'), 'Failed to unlink', cyan(label), 'with error:', (error as Error).message);
		process.exitCode = 1;
		return false;
	}
};

export const unlinkPackage = async (
	basePackagePath: string,
	dependency: string,
) => {
	const absolutePath = await resolveDependency(basePackagePath, dependency);

	if (!absolutePath) {
		console.warn(red('✖'), `Could not resolve dependency: ${dependency}`);
		process.exitCode = 1;
		return;
	}

	await unsymlinkOne(basePackagePath, absolutePath, dependency);
};

export const unlinkFromConfig = async (
	basePackagePath: string,
	config: LinkConfig,
	options: UnlinkOptions,
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
			const unlinked = await unsymlinkOne(basePackagePath, absolutePath, dependency);

			if (!unlinked || !recursive) {
				return;
			}

			const depConfig = await loadConfig(absolutePath);
			if (!depConfig || depConfig.deepLink === false) {
				return;
			}

			await unlinkFromConfig(absolutePath, depConfig, options, recursive, visited);
		}),
	);
};
