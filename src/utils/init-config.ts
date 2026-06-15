import path from 'path';
import fs from 'fs/promises';
import { green, red, cyan } from 'kolorist';
import type { LinkConfig } from '../types.ts';
import { fsExists } from './fs-exists.ts';
import type { InitFlags } from '../commands/init/index.ts';

const configJsonFile = 'link.config.json';

export const initConfig = async (
    packageDirectory: string,
    packagePaths: string[],
    options: InitFlags = {},
) => {
    const configJsonPath = path.join(packageDirectory, configJsonFile);
    // Abort rather than clobber an existing config (json or js)
    if (options.recursive) {
        packagePaths.forEach(path => {
            const filteredPaths = packagePaths.filter(current => current !== path);
            initConfig(path, filteredPaths);
        });
    }
    if (await fsExists(configJsonPath)) {
        console.warn(red('✖'), `Config file already exists in ${cyan(packageDirectory)}`);
        process.exitCode = 1;
        return;
    }

    const config: LinkConfig = {
        deepLink: options.deep || false,
        packages: packagePaths.map(path => path + "\n"),
    };

    await fs.writeFile(configJsonPath, `${JSON.stringify(config, null, '\t')}\n`);
    console.log(green('✔'), `Created ${cyan(configJsonFile)} with ${packagePaths.length} package(s)`);
};
