import { command } from 'cleye';
import { outdent } from 'outdent';
import { linkPackage, linkFromConfig } from '../../link-package/index.ts';
import { loadConfig } from '../../utils/load-config.ts';
import { updateConfig } from '../../utils/write-config.ts';
import { registerPackage } from '../../utils/registry.ts';
import { getProjectCwd } from '../../utils/project-cwd.ts';

export type LinkFlags = {
	alias?: string;
	deepLink?: boolean;
	recursive?: boolean;
	include: string[];
	exclude: string[];
};

export const runLink = async (
	cwdProjectPath: string,
	dependencies: string[],
	flags: LinkFlags,
	showHelp: () => void,
) => {
	const options = {
		include: flags.include,
		exclude: flags.exclude,
	};

	// Create/update this package's config when alias/deepLink/dependencies are
	// provided, then register it so other projects can depend on it by name/alias.
	if (flags.alias !== undefined || flags.deepLink !== undefined || dependencies.length > 0) {
		await updateConfig(cwdProjectPath, {
			alias: flags.alias,
			deepLink: flags.deepLink,
			setDependencies: dependencies,
		});
	}
	await registerPackage(cwdProjectPath);

	// Recursive link from config (links deps, then descends into their configs).
	if (flags.recursive) {
		const config = await loadConfig(cwdProjectPath);
		if (config) {
			await linkFromConfig(cwdProjectPath, config, options, true);
		}
		return;
	}

	// Link the dependencies passed on the command line (one level).
	if (dependencies.length > 0) {
		await Promise.all(
			dependencies.map(dependency => linkPackage(cwdProjectPath, dependency)),
		);
		return;
	}

	// Bare `global link`: link from config one level, or warn if there's none.
	const config = await loadConfig(cwdProjectPath);
	if (!config) {
		console.warn(
			outdent`
			Warning: Config file "link.config.json" not found in current directory.
			`,
		);
		showHelp();
		return;
	}

	await linkFromConfig(cwdProjectPath, config, options, false);
};

const flags = {
	alias: {
		type: String,
		alias: 'a',
		description: "Set this package's alias in its config",
	},
	deepLink: {
		type: Boolean,
		alias: 'd',
		description: "Set this package's \"deepLink\" in its config",
	},
	recursive: {
		type: Boolean,
		alias: 'r',
		description: 'Link from config, then descend into dependencies\' configs',
	},
	include: {
		type: [String],
		alias: 'i',
		description: 'Only link dependencies whose name or alias matches (repeatable)',
	},
	exclude: {
		type: [String],
		alias: 'e',
		description: 'Skip dependencies whose name or alias matches (repeatable)',
	},
} as const;

export const linkFlags = flags;

export const linkCommand = command({
	name: 'link',
	parameters: ['[dependencies...]'],
	flags,
	help: {
		description: 'Symlink local dependencies into the current project and record them in its config',
	},
}, async (argv) => {
	const cwdProjectPath = await getProjectCwd();
	await runLink(cwdProjectPath, argv._.dependencies, argv.flags, argv.showHelp);
});
