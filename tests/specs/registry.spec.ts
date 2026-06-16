import path from 'path';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import {
	registerPackage,
	resolveDependency,
	loadRegistry,
} from '../../src/utils/registry.ts';

/**
 * The registry lives at `~/.globalink/registry.json`, resolved via os.homedir()
 * which reads $HOME. Point it at a disposable fixture so tests never touch the
 * real user home, and restore it afterwards.
 */
const withHome = async (home: string, fn: () => Promise<void>) => {
	const originalHome = process.env.HOME;
	const originalProfile = process.env.USERPROFILE;
	process.env.HOME = home;
	process.env.USERPROFILE = home;
	try {
		await fn();
	} finally {
		process.env.HOME = originalHome;
		process.env.USERPROFILE = originalProfile;
	}
};

export const registrySpec = (_nodePath: string) => {
	describe('registry', () => {
		test('registerPackage writes name and alias entries', async () => {
			await using fixture = await createFixture({
				home: {},
				'pkg-a': {
					'package.json': JSON.stringify({ name: 'pkg-a' }),
					'link.config.json': JSON.stringify({ alias: 'a-alias' }),
				},
			});

			const home = path.join(fixture.path, 'home');
			const pkgPath = path.join(fixture.path, 'pkg-a');

			await withHome(home, async () => {
				await registerPackage(pkgPath);

				const registry = await loadRegistry();
				expect(registry['pkg-a']).toBe(pkgPath);
				expect(registry['a-alias']).toBe(pkgPath);
			});
		});

		test('resolveDependency handles absolute, relative, alias, name and missing', async () => {
			await using fixture = await createFixture({
				home: {},
				'pkg-a': {
					'package.json': JSON.stringify({ name: 'pkg-a' }),
					'link.config.json': JSON.stringify({ alias: 'a-alias' }),
				},
				consumer: {
					'package.json': JSON.stringify({ name: 'consumer' }),
				},
			});

			const home = path.join(fixture.path, 'home');
			const pkgPath = path.join(fixture.path, 'pkg-a');
			const consumerPath = path.join(fixture.path, 'consumer');

			await withHome(home, async () => {
				await registerPackage(pkgPath);

				// Absolute path
				expect(await resolveDependency(consumerPath, pkgPath)).toBe(pkgPath);
				// Relative path
				expect(await resolveDependency(consumerPath, '../pkg-a')).toBe(pkgPath);
				// Alias from registry
				expect(await resolveDependency(consumerPath, 'a-alias')).toBe(pkgPath);
				// Package name from registry
				expect(await resolveDependency(consumerPath, 'pkg-a')).toBe(pkgPath);
				// Unknown
				expect(await resolveDependency(consumerPath, 'does-not-exist')).toBe(undefined);
			});
		});
	});
};
