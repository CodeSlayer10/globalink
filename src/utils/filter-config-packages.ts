import { red } from 'kolorist';
import { loadConfig } from './load-config.ts';
import { readPackageJson } from './read-package-json.ts';
import { resolveDependency } from './registry.ts';

export type ResolvedDependency = {
	dependency: string;
	absolutePath: string;
};

/**
 * Resolve a config's `dependencies` (aliases, package names, or paths) to
 * absolute paths, applying `--include`/`--exclude` filtering against each
 * dependency's package name, config alias, and the raw dependency string.
 * Unresolvable dependencies are warned about and dropped.
 */
export const resolveDependencies = async (
	basePackagePath: string,
	dependencies: string[],
	options: {
		include?: string[];
		exclude?: string[];
	} = {},
): Promise<ResolvedDependency[]> => {
	const { include, exclude } = options;
	const hasFilter = Boolean(include?.length || exclude?.length);

	const resolved = await Promise.all(
		dependencies.map(async (dependency) => {
			const absolutePath = await resolveDependency(basePackagePath, dependency);

			if (!absolutePath) {
				console.warn(red('✖'), `Could not resolve dependency: ${dependency}`);
				process.exitCode = 1;
				return undefined;
			}

			let keys = [dependency];
			if (hasFilter) {
				let name: string | undefined;
				let alias: string | undefined;
				try {
					({ name } = await readPackageJson(absolutePath));
				} catch {}
				try {
					alias = (await loadConfig(absolutePath))?.alias;
				} catch {}
				keys = [dependency, name, alias].filter(Boolean) as string[];
			}

			return { dependency, absolutePath, keys };
		}),
	);

	return resolved
		.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
		.filter(({ keys }) => (
			(!include?.length || keys.some(key => include.includes(key)))
			&& (!exclude?.length || !keys.some(key => exclude.includes(key)))
		))
		.map(({ dependency, absolutePath }) => ({ dependency, absolutePath }));
};
