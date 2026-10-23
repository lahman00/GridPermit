// Guard for tools whose output contains private search or revenue metrics:
// the destination must resolve to a location outside the repository, following
// symlinks, even when the destination directory does not exist yet.
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function realOfNearestAncestor(p) {
	let cur = path.resolve(p);
	const tail = [];
	while (!existsSync(cur)) {
		tail.unshift(path.basename(cur));
		const parent = path.dirname(cur);
		if (parent === cur) break;
		cur = parent;
	}
	return path.join(realpathSync(cur), ...tail);
}

export function insideRepo(p, repoRoot = REPO_ROOT) {
	const real = realOfNearestAncestor(p);
	const root = realpathSync(repoRoot);
	const rel = path.relative(root, real);
	return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function assertOutsideRepo(p, repoRoot = REPO_ROOT) {
	if (insideRepo(p, repoRoot)) {
		throw new Error("Refusing to write inside the repository: the output contains private search and revenue metrics. Use a directory outside the repo.");
	}
}
