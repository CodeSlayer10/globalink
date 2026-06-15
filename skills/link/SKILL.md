---
name: link
description: "Symlink or hardlink local packages into node_modules using the `global` CLI (`global link`). Use when linking local dependencies for development, setting up publish-mode hardlinks, or configuring link.config.json. Do not use for general symlink/hardlink filesystem questions or npm link internals."
---

# global

Safer `npm link` alternative — symlinks local packages directly into `node_modules` without global installs or dependency reinstalls.

## Commands

| Command | Purpose |
|---------|---------|
| `global link <paths...>` | Symlink local packages into `node_modules` |
| `global link` | Link all packages from `link.config.json` |
| `global link --deep` / `-d` | Recursively link dependencies that have their own `link.config.json` |
| `global link --include <name>` / `-i` | Link only configured packages matching the given name or alias (repeatable) |
| `global link --exclude <name>` / `-e` | Skip configured packages matching the given name or alias (repeatable) |
| `global unlink <paths...>` | Remove symlinks previously created by `link` |
| `global unlink` | Remove symlinks for all packages in `link.config.json` |
| `global unlink --deep` / `-d` | Recursively unlink dependencies that have their own `link.config.json` |
| `global unlink --include <name>` / `-i` | Unlink only configured packages matching the given name or alias (repeatable) |
| `global unlink --exclude <name>` / `-e` | Skip configured packages matching the given name or alias (repeatable) |
| `global publish <paths...>` | Hardlink only publishable files (simulates `npm install`) |

Running `global <paths...>` with no subcommand is shorthand for `global link <paths...>`.

## Symlink Mode (Default)

Creates a symlink at `node_modules/<package-name>` pointing to the local package directory. Also symlinks binaries into `node_modules/.bin/`.

```sh
# From the consuming project directory
global link ../my-library
```

Remove links with `global unlink` (the inverse of `link` — accepts the same paths, `link.config.json` fallback, `--deep`, `--include`, and `--exclude`). It only removes symlinks `link` created; a real installed directory is left intact. Running `npm install` also restores `node_modules` integrity.

### When to use symlink mode
- Quick iteration on a local dependency
- The dependency has no shared sub-dependencies that cause duplication issues

## Publish Mode

Hardlinks only the files that `npm publish` would include (respects `files` field, `.npmignore`). Avoids the duplicate `node_modules` problem that symlinks cause.

### Setup

```sh
# 1. In the dependency package — create a tarball
cd ../my-library
npm pack

# 2. In the consuming project — install tarball, then link
npm install --no-save ../my-library/my-library-1.0.0.tgz
global publish ../my-library
```

### When to use publish mode
- Dependency shares sub-dependencies with the consuming project (e.g., React, Vue)
- Testing the exact publish output before releasing
- Bundlers or Node.js resolve modules via realpath (symlinks break resolution)

### Limitations
- New files in the dependency require re-running `global publish <path>`
- The dependency must already be installed (via tarball) before linking

## Configuration File

`link.config.json` (or `link.config.js`) at the consuming project root:

```json
{
    "packages": [
        "../dependency-a",
        "/absolute/path/to/dependency-b"
    ],
    "deepLink": false,
    "alias": "dep-a"
}
```

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `packages` | `string[]` | — | Paths to dependency packages (absolute or relative) |
| `deepLink` | `boolean` | `false` | Recursively link dependencies that have their own `link.config.json` |
| `alias` | `string` | — | Short handle for this package, used to match `--include`/`--exclude`. Does **not** change the name the package is linked under in `node_modules`. |

Do not commit `link.config.json` — paths are machine-specific.

Run `global link` with no arguments to link all configured packages. Use `global link --deep` or set `"deepLink": true` to enable recursive linking.

## Filtering Which Packages to Link

When linking from `link.config.json`, use `--include`/`-i` and `--exclude`/`-e` to link only a subset of the configured packages. Both flags are repeatable and match against each package's `name` (from its `package.json`) or its `alias` (declared in that package's own `link.config.json`).

```sh
# Link only the matching packages
global link --include dependency-a --include dep-b

# Link everything except the matching packages
global link --exclude dependency-a

# Match by alias instead of package name
global link -i dep-a
```

Filtering applies only to the config flow (`global link` with no path arguments) — it does not affect paths passed directly on the command line. Filters apply only to the top-level config and are not propagated into `--deep` recursion.

## Symlink vs Publish Mode

| Concern | Symlink mode | Publish mode |
|---------|-------------|-------------|
| Speed | Instant | Requires initial `npm pack` + install |
| Shared dependencies | May duplicate (two `node_modules` trees) | Production-accurate (single tree) |
| File scope | Entire package directory | Only publishable files |
| Link type | Symbolic link | Hard link |
| Realpath resolution | Points to source directory | Points to `node_modules` copy |
| New file detection | Automatic | Requires re-run |
