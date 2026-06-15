import { command } from 'cleye';
import { outdent } from 'outdent';
import { unlinkPackage, unlinkFromConfig } from '../../unlink-package/index.ts';
import { loadConfig } from '../../utils/load-config.ts';
import { getProjectCwd } from '../../utils/project-cwd.ts';

type UnlinkFlags = {
	deep?: boolean;
	include: string[];
	exclude: string[];
};

export const runUnlink = async (
	cwdProjectPath: string,
	packagePaths: string[],
	flags: UnlinkFlags,
	showHelp: () => void,
) => {
	if (packagePaths.length > 0) {
		await Promise.all(
			packagePaths.map(
				linkPackagePath => unlinkPackage(
					cwdProjectPath,
					linkPackagePath,
					flags,
				),
			),
		);
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

	await unlinkFromConfig(
		cwdProjectPath,
		config,
		{
			deep: flags.deep,
			include: flags.include,
			exclude: flags.exclude,
		},
	);
};

export const unlinkCommand = command({
	name: 'unlink',
	parameters: ['[package paths...]'],
	flags: {
		deep: {
			type: Boolean,
			alias: 'd',
			description: 'Recursively unlink dependencies that have a link.config.json',
		},
		include: {
			type: [String],
			alias: 'i',
			description: 'Only unlink packages whose name or alias matches (repeatable)',
		},
		exclude: {
			type: [String],
			alias: 'e',
			description: 'Skip packages whose name or alias matches (repeatable)',
		},
	},
	help: {
		description: 'Remove symlinks previously created by `global link`',
	},
}, async (argv) => {
	const cwdProjectPath = await getProjectCwd();
	await runUnlink(cwdProjectPath, argv._.packagePaths, argv.flags, argv.showHelp);
});
