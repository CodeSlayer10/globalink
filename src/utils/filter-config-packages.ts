import path from 'path';
import { loadConfig } from './load-config.ts';
import { readPackageJson } from './read-package-json.ts';

/**
 * Resolves the list of package paths to act on from a config, applying
 * `--include`/`--exclude` filtering against each package's name and alias.
 */
export const resolvePackagePaths = async (
	basePackagePath: string,
	packages: string[],
	options: {
		include?: string[];
		exclude?: string[];
	},
) => {
	const { include, exclude } = options;

	if (!(include?.length || exclude?.length)) {
		return packages;
	}

	const resolved = await Promise.all(
		packages.map(async (linkPackagePath) => {
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

	return resolved
		.filter(({ keys }) => (
			(!include?.length || keys.some(key => include.includes(key)))
			&& (!exclude?.length || !keys.some(key => exclude.includes(key)))
		))
		.map(({ linkPackagePath }) => linkPackagePath);
};
