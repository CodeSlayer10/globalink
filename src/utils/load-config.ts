import path from 'path';
import { createRequire } from 'module';
import type { LinkConfig } from '../types.ts';
import { fsExists } from './fs-exists.ts';
import { readJsonFile } from './read-json-file.ts';

const configJsonFile = 'link.config.json';

export const loadConfig = async (
	packageDirectory: string,
) => {
	const configJsonPath = path.join(packageDirectory, configJsonFile);
	if (await fsExists(configJsonPath)) {
		try {
			return await readJsonFile(configJsonPath) as LinkConfig;
		} catch (error) {
			throw new Error(`Failed to parse config JSON ${configJsonPath}: ${(error as Error).message}`);
		}
	}
};
