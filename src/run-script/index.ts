import path from 'path';
import { execa } from 'execa';
import { green, red, cyan, magenta, yellow } from 'kolorist';
import type { LinkConfig } from '../types.ts';
import { loadConfig } from '../utils/load-config.ts';
import { resolveDependencies } from '../utils/filter-config-packages.ts';

type RunOptions = {
	include?: string[];
	exclude?: string[];
};

type CollectedPackage = {
	packagePath: string;
	config: LinkConfig;
};

/**
 * Run a single script command in `packagePath`. The package's `node_modules/.bin`
 * is put on PATH (`preferLocal`) and output is streamed (`stdio: 'inherit'`). A
 * non-zero exit makes execa throw, which propagates up to halt an `-r` chain.
 */
export const runScript = async (
	packagePath: string,
	command: string,
) => {
	console.log(green('▶'), `Running ${magenta(command)} in`, cyan(packagePath));
	const process = await execa(command, {
		cwd: packagePath,
		shell: true,
		stdio: 'inherit',
		preferLocal: true,
	});
	return process.exitCode;
};

/**
 * Post-order walk of a package's dependency graph, producing a deps-first,
 * deduped list of packages. Mirrors `linkFromConfig`'s traversal: the
 * `deepLink !== false` guard stops descent into a package's own dependencies
 * (that package still appears in the list), `visited` dedups the diamond case,
 * and `--include`/`--exclude` filter which dependencies to descend into.
 */
const collectPackages = async (
	basePackagePath: string,
	config: LinkConfig,
	options: RunOptions,
	recursive: boolean,
	visited: Set<string> = new Set(),
): Promise<CollectedPackage[]> => {
	const resolvedBase = path.resolve(basePackagePath);
	if (visited.has(resolvedBase)) {
		return [];
	}
	visited.add(resolvedBase);

	const packages: CollectedPackage[] = [];

	if (recursive && config.dependencies && config.deepLink !== false) {
		const dependencies = await resolveDependencies(
			basePackagePath,
			config.dependencies,
			options,
		);

		for (const { absolutePath } of dependencies) {
			const depConfig = await loadConfig(absolutePath);
			if (depConfig) {
				const depPackages = await collectPackages(absolutePath, depConfig, options, recursive, visited);
				packages.push(...depPackages);
			}
		}
	}

	packages.push({ packagePath: basePackagePath, config });
	return packages;
};

/**
 * Run a named script across a package's dependency graph (deps-first when
 * `recursive`). Packages that don't define the script are skipped silently.
 */
export const runScriptFromConfig = async (
	basePackagePath: string,
	config: LinkConfig,
	scriptName: string,
	options: RunOptions,
	recursive: boolean,
) => {
	const packages = await collectPackages(basePackagePath, config, options, recursive);

	let ran = 0;
	for (const { packagePath, config: packageConfig } of packages) {
		const command = packageConfig.scripts?.[scriptName];

		if (!command) {
			console.log(yellow('⚠'), `${scriptName} not found in ${packageConfig.alias ?? packagePath}`)
			continue;
		}
		const exitCode = await runScript(packagePath, command);
		ran += 1;

		if (exitCode) {
			console.log(red('✖'), `${scriptName} failed to run in ${packageConfig.alias ?? packagePath}`)
		} else {
			console.log(green('✔'), `${scriptName} successfully run in ${packageConfig.alias ?? packagePath}`);
		}
	}

	if (ran === 0) {
		console.warn(red('✖'), `No package defines a "${scriptName}" script`);
		process.exitCode = 1;
	}
};