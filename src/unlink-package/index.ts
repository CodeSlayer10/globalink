import path from 'path';
import {
	green, red, yellow, cyan, magenta,
} from 'kolorist';
import { fsExists } from '../utils/fs-exists.ts';
import type { LinkConfig } from '../types.ts';
import { loadConfig } from '../utils/load-config.ts';
import { resolvePackagePaths } from '../utils/filter-config-packages.ts';
import { unsymlinkPackage } from './unsymlink-package.ts';

export const unlinkPackage = async (
	basePackagePath: string,
	linkPackagePath: string,
	options: {
		deep?: boolean;
	},
	visited: Set<string> = new Set(),
) => {
	const absoluteLinkPackagePath = path.resolve(basePackagePath, linkPackagePath);
	const pathExists = await fsExists(absoluteLinkPackagePath);

	if (!pathExists) {
		console.warn(red('✖'), `Package path does not exist: ${linkPackagePath}`);
		process.exitCode = 1;
		return;
	}

	try {
		const link = await unsymlinkPackage(
			basePackagePath,
			linkPackagePath,
		);

		if (link.skippedNonSymlink) {
			console.warn(yellow('⚠'), `Skipped ${magenta(link.name)}: not a symlink`, cyan(link.path));
		} else {
			console.log(green('✔'), `Unlinked ${magenta(link.name)}:`, cyan(link.path));
		}
	} catch (error) {
		console.warn(red('✖'), 'Failed to unlink', cyan(linkPackagePath), 'with error:', (error as Error).message);
		process.exitCode = 1;
		return;
	}

	if (options.deep) {
		const config = await loadConfig(absoluteLinkPackagePath);

		if (config) {
			await unlinkFromConfig(
				absoluteLinkPackagePath,
				config,
				options,
				visited,
			);
		}
	}
};

export const unlinkFromConfig = async (
	basePackagePath: string,
	config: LinkConfig,
	options: {
		deep?: boolean;
		include?: string[];
		exclude?: string[];
	},
	visited: Set<string> = new Set(),
) => {
	if (!config.packages) {
		return;
	}

	const resolvedBase = path.resolve(basePackagePath);
	if (visited.has(resolvedBase)) {
		return;
	}
	visited.add(resolvedBase);

	const packagePaths = await resolvePackagePaths(
		basePackagePath,
		config.packages,
		options,
	);

	const newOptions = {
		deep: options.deep ?? config.deepLink ?? false,
	};

	await Promise.all(
		packagePaths.map(
			async linkPackagePath => await unlinkPackage(
				basePackagePath,
				linkPackagePath,
				newOptions,
				visited,
			),
		),
	);
};
