import path from 'path';
import fs from 'fs/promises';
import { green, cyan } from 'kolorist';
import type { LinkConfig } from '../types.ts';
import { loadConfig } from './load-config.ts';

const configJsonFile = 'link.config.json';

type ConfigUpdate = {
	alias?: string;
	deepLink?: boolean;
	setDependencies?: string[];
};

/**
 * Create or update a package's link.config.json. Existing `alias`/`deepLink` are
 * preserved unless explicitly provided (via `-a`/`-d`). `dependencies` are
 * replaced with `setDependencies` each time (deduped, order preserved) when a
 * non-empty list is given.
 */
export const updateConfig = async (
	packageDirectory: string,
	update: ConfigUpdate,
): Promise<LinkConfig> => {
	const configJsonPath = path.join(packageDirectory, configJsonFile);
	const existing = (await loadConfig(packageDirectory)) ?? {};

	const config: LinkConfig = { ...existing };

	if (update.alias !== undefined) {
		config.alias = update.alias;
	}
	if (update.deepLink !== undefined) {
		config.deepLink = update.deepLink;
	}
	if (update.setDependencies?.length) {
		config.dependencies = [...new Set(update.setDependencies)];
	}

	await fs.writeFile(configJsonPath, `${JSON.stringify(config, null, '\t')}\n`);
	console.log(green('✔'), `Updated ${cyan(configJsonFile)} in ${cyan(packageDirectory)}`);

	return config;
};

/**
 * Remove dependencies from a package's config (used by unlink). No-op if the
 * config or the dependencies don't exist.
 */
export const removeDependencies = async (
	packageDirectory: string,
	dependencies: string[],
): Promise<void> => {
	if (!dependencies.length) {
		return;
	}

	const config = await loadConfig(packageDirectory);
	if (!config?.dependencies?.length) {
		return;
	}

	const remaining = config.dependencies.filter(
		dependency => !dependencies.includes(dependency),
	);

	if (remaining.length === config.dependencies.length) {
		return;
	}

	config.dependencies = remaining;
	const configJsonPath = path.join(packageDirectory, configJsonFile);
	await fs.writeFile(configJsonPath, `${JSON.stringify(config, null, '\t')}\n`);
};
