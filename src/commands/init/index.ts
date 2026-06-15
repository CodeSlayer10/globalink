import { command } from 'cleye';
import { getProjectCwd } from '../../utils/project-cwd.ts';
import { initConfig } from '../../utils/init-config.ts';

export type InitFlags = {
    deep?: boolean;
    recursive?: boolean;
};

export const runInit = async (
    cwdProjectPath: string,
    packagePaths: string[],
    flags: InitFlags,
) => {
    await initConfig(cwdProjectPath, packagePaths, flags);
};

export const initCommand = command({
    name: 'init',
    parameters: ['[package paths...]'],
    flags: {
        deep: {
            type: Boolean,
            alias: 'd',
            description: 'Set "deepLink": true in the generated config',
        },
        recursive: {
            type: Boolean,
            alias: 'r',
            description: 'recursively creates config file in package paths'
        }
    },
    help: {
        description: 'Generate a link.config.json in the current project',
    },
}, async (argv) => {
    const cwdProjectPath = await getProjectCwd();
    await runInit(cwdProjectPath, argv._.packagePaths, argv.flags);
});
