---
name: globalink
description: "Symlink local packages into node_modules using the `global` CLI (`global link`). Link by path or by registered name/alias, configure dependencies and scripts in link.config.json, recursively link a dependency graph, and run scripts across linked packages with `global run`. Use when wiring up local dependencies for development. Do not use for general symlink filesystem questions or npm link internals."
---

# global

A safer `npm link` alternative — symlinks local packages directly into `node_modules` (no global installs, no dependency reinstalls) and keeps a recoverable record of what was linked: a per-project `link.config.json` plus a global registry that maps package names and aliases to their locations on disk.

## Commands

| Command | Purpose |
|---------|---------|
| `global link <deps...>` | Symlink local packages into `node_modules` and record them in config |
| `global link` | Link all `dependencies` from `link.config.json` (one level) |
| `global link --recursive` / `-r` | Link from config, then descend into each dependency's own config |
| `global link --alias <name>` / `-a` | Set this package's alias in its config (then register it) |
| `global link --deepLink` / `-d` | Set this package's `deepLink` flag in its config |
| `global link --include <name>` / `-i` | Link only configured deps matching the name/alias (repeatable) |
| `global link --exclude <name>` / `-e` | Skip configured deps matching the name/alias (repeatable) |
| `global unlink <deps...>` | Remove symlinks created by `link` and drop the deps from config |
| `global unlink` | Unlink all `dependencies` in `link.config.json` |
| `global unlink --recursive` / `-r` | Unlink from config, then descend into dependencies' configs |
| `global unlink --include` / `-i`, `--exclude` / `-e` | Filter which configured deps to unlink (repeatable) |
| `global run <script>` | Run a named script from config's `scripts` map |
| `global run <script> --recursive` / `-r` | Run the script across the dependency graph, deps-first |
| `global run <script> --include` / `-i`, `--exclude` / `-e` | Filter which deps to descend into (repeatable) |

Running `global <deps...>` with no subcommand is shorthand for `global link <deps...>`.

## Linking

A dependency argument may be an **absolute path, a relative path, a package name, or an alias**. Paths are resolved relative to the current project; bare names and aliases are looked up in the global registry (see below).

```sh
# From the consuming project directory
global link ../my-library           # relative path
global link /abs/path/to/my-library # absolute path
global link my-library              # package name (resolved via registry)
global link my-lib                  # alias (resolved via registry)
```

Each link:
- Creates a symlink at `node_modules/<package-name>` pointing to the local package directory.
- Symlinks the package's binaries into `node_modules/.bin/`.
- Records the dependency in this project's `link.config.json`.
- Registers this project in the global registry under its package name (and alias, if set) so other projects can link it by name.

Remove links with `global unlink`, the inverse of `link` — it accepts the same arguments, the same `link.config.json` fallback, and the same `--recursive` / `--include` / `--exclude` flags. It only removes symlinks that `link` created and drops them from config; a real installed directory is left intact. Running `npm install` also restores `node_modules`.

## Recursive Linking (`--recursive` / `-r`)

`global link --recursive` links the project's configured `dependencies`, then descends into each dependency's own `link.config.json` and links *its* dependencies too, and so on. Traversal stops when it reaches a package whose config sets `"deepLink": false`, or a package it has already visited (diamond dependencies are deduped).

```sh
global link --recursive
```

## The Registry

`global` maintains a global registry at `~/.globalink/registry.json`, a map of `{ "<name-or-alias>": "<absolute-path>" }`. Every `global link` registers the linked-from project under its `package.json` `name` and, if set, its config `alias`.

Once a package is registered (by being linked at least once, or by running `global link --alias <name>` in it), any other project can link it by name or alias without knowing its path:

```sh
# In the library, register it under an alias
cd ../my-library
global link --alias my-lib

# In any consuming project, link by alias — no path needed
global link my-lib
```

## Configuration File

`link.config.json` at the project root:

```json
{
    "alias": "my-lib",
    "deepLink": true,
    "dependencies": [
        "../dependency-a",
        "dependency-b",
        "dep-c-alias"
    ],
    "scripts": {
        "build": "pkgroll",
        "test": "node tests/index.ts"
    }
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `alias` | `string` | This package's short handle. Used as a registry key others can link by, and matched by `--include`/`--exclude`. |
| `deepLink` | `boolean` | During a recursive (`-r`) link/run, whether to descend into *this* package's own dependencies. Defaults to descending; set `false` to stop the chain here. |
| `dependencies` | `string[]` | Packages to link — each an alias, package name, absolute path, or relative path. |
| `scripts` | `Record<string,string>` | Named shell commands, run via `global run <name>`. |

`global link <deps...>` writes the deps into `dependencies`; `global link --alias`/`--deepLink` set those fields. Run `global link` with no arguments to link everything in `dependencies`.

Path-based entries are machine-specific — prefer name/alias references (resolved via the registry) for portability, and avoid committing machine-specific absolute paths.

## Running Scripts

`global run <script>` runs the matching entry from the config's `scripts` map. The command runs with the package's `node_modules/.bin` on `PATH` (so locally-installed binaries resolve), and its output is streamed.

```sh
global run build
```

With `--recursive` / `-r`, the script runs across the dependency graph **deps-first** (post-order): each dependency's script runs before the dependent's.

```sh
global run build --recursive
```

- Packages that don't define the named script are skipped silently.
- A non-zero exit halts the chain.
- If no package in the graph defines the script, it warns and exits with code 1.

The same `--include` / `--exclude` filters and `deepLink: false` stop-points apply as for recursive linking.

## Filtering Which Packages to Act On

When operating from `link.config.json`, use `--include` / `-i` and `--exclude` / `-e` to act on only a subset of configured dependencies. Both flags are repeatable and match against each dependency's raw config string, its `package.json` `name`, and its config `alias`.

```sh
# Link only the matching dependencies
global link --include dependency-a --include dep-b

# Link everything except the matching dependencies
global link --exclude dependency-a

# Match by alias
global link -i dep-a
```

Filtering applies only to the config flow (`global link` / `global unlink` / `global run` with no path arguments) — it does not affect dependencies passed directly on the command line. Under `--recursive`, the filters are threaded through every level of the traversal, so they apply to each dependency's config too, not just the top-level one.
