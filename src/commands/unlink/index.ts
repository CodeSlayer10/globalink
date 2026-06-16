import { command } from 'cleye';
import { outdent } from 'outdent';
import { unlinkPackage, unlinkFromConfig } from '../../unlink-package/index.ts';
import { loadConfig } from '../../utils/load-config.ts';
import { removeDependencies } from '../../utils/write-config.ts';
import { getProjectCwd } from '../../utils/project-cwd.ts';

export type UnlinkFlags = {
	recursive?: boolean;
	include: string[];
	exclude: string[];
};

export const runUnlink = async (
	cwdProjectPath: string,
	dependencies: string[],
	flags: UnlinkFlags,
	showHelp: () => void,
) => {
	const options = {
		include: flags.include,
		exclude: flags.exclude,
	};

	if (dependencies.length > 0) {
		await Promise.all(
			dependencies.map(dependency => unlinkPackage(cwdProjectPath, dependency)),
		);
		// Drop them from this package's config (symmetry with link recording them).
		await removeDependencies(cwdProjectPath, dependencies);
		return;
	}

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

	await unlinkFromConfig(cwdProjectPath, config, options, Boolean(flags.recursive));
};

export const unlinkCommand = command({
	name: 'unlink',
	parameters: ['[dependencies...]'],
	flags: {
		recursive: {
			type: Boolean,
			alias: 'r',
			description: 'Unlink from config, then descend into dependencies\' configs',
		},
		include: {
			type: [String],
			alias: 'i',
			description: 'Only unlink dependencies whose name or alias matches (repeatable)',
		},
		exclude: {
			type: [String],
			alias: 'e',
			description: 'Skip dependencies whose name or alias matches (repeatable)',
		},
	},
	help: {
		description: 'Remove symlinks previously created by `global link`',
	},
}, async (argv) => {
	const cwdProjectPath = await getProjectCwd();
	await runUnlink(cwdProjectPath, argv._.dependencies, argv.flags, argv.showHelp);
});
