import path from 'path';
import fs from 'fs/promises';
import { readPackageJson } from '../utils/read-package-json.ts';
import { linkBinaries } from '../link-package/link-binaries.ts';

const nodeModulesDirectory = 'node_modules';

/**
 * Removes a path only if it's a symlink. Returns whether it existed but was
 * not a symlink (so the caller can warn and skip).
 */
const removeSymlink = async (
	symlinkPath: string,
) => {
	const stats = await fs.lstat(symlinkPath).catch(() => null);
	if (!stats) {
		return {
			removed: false,
			skippedNonSymlink: false,
		};
	}

	if (!stats.isSymbolicLink()) {
		return {
			removed: false,
			skippedNonSymlink: true,
		};
	}

	await fs.rm(symlinkPath, { recursive: true });
	return {
		removed: true,
		skippedNonSymlink: false,
	};
};

/**
 * Removes a linked binary. Ignores its target path (only present to satisfy
 * the `linkBinaries` callback signature). On Windows, cmd-shim creates
 * `.cmd`/`.ps1` wrappers alongside the shell script rather than a symlink, so
 * remove those siblings too.
 */
const unlinkBinary = async (
	_targetPath: string,
	linkPath: string,
) => {
	await Promise.all(
		[linkPath, `${linkPath}.cmd`, `${linkPath}.ps1`].map(
			binPath => fs.rm(binPath, { force: true }),
		),
	);
};

export const unsymlinkPackage = async (
	basePackagePath: string,
	linkPackagePath: string,
) => {
	const absoluteLinkPackagePath = path.resolve(basePackagePath, linkPackagePath);
	const packageJson = await readPackageJson(absoluteLinkPackagePath);
	const nodeModulesPath = path.join(basePackagePath, nodeModulesDirectory);
	const symlinkPath = path.join(nodeModulesPath, packageJson.name);

	const { skippedNonSymlink } = await removeSymlink(symlinkPath);

	await linkBinaries(
		absoluteLinkPackagePath,
		nodeModulesPath,
		packageJson,
		unlinkBinary,
	);

	return {
		name: packageJson.name,
		path: symlinkPath,
		skippedNonSymlink,
	};
};
