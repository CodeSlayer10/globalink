import path from 'path';
import {
	green, red, cyan, magenta,
} from 'kolorist';
import { fsExists } from '../utils/fs-exists.ts';
import type { LinkConfig } from '../types.ts';
import { loadConfig } from '../utils/load-config.ts';
import { readPackageJson } from '../utils/read-package-json.ts';
import { symlinkPackage } from './symlink-package.ts';

export const linkPackage = async (
	basePackagePath: string,
	linkPackagePath: string,
	options: {
		deep?: boolean;
	},
) => {
	const absoluteLinkPackagePath = path.resolve(basePackagePath, linkPackagePath);
	const pathExists = await fsExists(absoluteLinkPackagePath);

	if (!pathExists) {
		console.warn(red('✖'), `Package path does not exist: ${linkPackagePath}`);
		process.exitCode = 1;
		return;
	}

	try {
		const link = await symlinkPackage(
			basePackagePath,
			linkPackagePath,
		);
		console.log(green('✔'), `Symlinked ${magenta(link.name)}:`, cyan(link.path), '→', cyan(link.target));
	} catch (error) {
		console.warn(red('✖'), 'Failed to symlink', cyan(linkPackagePath), 'with error:', (error as Error).message);
		process.exitCode = 1;
		return;
	}

	if (options.deep) {
		const config = await loadConfig(absoluteLinkPackagePath);

		if (config) {
			await linkFromConfig(
				absoluteLinkPackagePath,
				config,
				options,
			);
		}
	}
};

export const linkFromConfig = async (
	basePackagePath: string,
	config: LinkConfig,
	options: {
		deep?: boolean;
		include?: string[];
		exclude?: string[];
	},
) => {
	if (!config.packages) {
		return;
	}

	const { include, exclude } = options;
	let packagePaths = config.packages;

	if (include?.length || exclude?.length) {
		const resolved = await Promise.all(
			config.packages.map(async (linkPackagePath) => {
				const absolutePath = path.resolve(basePackagePath, linkPackagePath);
				let name: string | undefined;
				let alias: string | undefined;
				try {
					({ name } = await readPackageJson(absolutePath));
				} catch {}
				try {
					const packageConfig = await loadConfig(absolutePath);
					alias = packageConfig?.alias;
				} catch {}
				const keys = [name, alias].filter(Boolean) as string[];
				return {
					linkPackagePath,
					keys,
				};
			}),
		);

		packagePaths = resolved
			.filter(({ keys }) => (
				(!include?.length || keys.some(key => include.includes(key)))
				&& (!exclude?.length || !keys.some(key => exclude.includes(key)))
			))
			.map(({ linkPackagePath }) => linkPackagePath);
	}

	const newOptions = {
		deep: options.deep ?? config.deepLink ?? false,
	};

	await Promise.all(
		packagePaths.map(
			async linkPackagePath => await linkPackage(
				basePackagePath,
				linkPackagePath,
				newOptions,
			),
		),
	);
};
