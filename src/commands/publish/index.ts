import { command } from 'cleye';
import { getProjectCwd } from '../../utils/project-cwd.ts';
import { linkPublishMode } from './link-publish-mode.ts';

export const publishCommand = command({
	name: 'publish',
	parameters: ['<package paths...>'],
	flags: {
		// watch: {
		// 	type: Boolean,
		// 	alias: 'w',
		// 	description: 'Watch for changes in the package and automatically relink',
		// },
	},
	help: {
		description: 'Link a package to simulate an environment similar to `npm install`',
	},
}, async (argv) => {
	const cwdProjectPath = await getProjectCwd();
	const { packagePaths } = argv._;

	if (packagePaths.length > 0) {
		await Promise.all(
			packagePaths.map(
				linkPackagePath => linkPublishMode(
					cwdProjectPath,
					linkPackagePath,
				),
			),
		);
	}
});
