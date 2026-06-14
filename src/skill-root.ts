import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const PACKAGE_NAME = "js-video-edit-skill";

let cachedSkillRoot: string | null = null;

export function resolveSkillRoot(fromModuleUrl: string): string {
  if (cachedSkillRoot) return cachedSkillRoot;

  let dir = path.dirname(fileURLToPath(fromModuleUrl));
  const root = path.parse(dir).root;

  while (dir !== root) {
    const pkgPath = path.join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { name?: string };
        if (pkg.name === PACKAGE_NAME) {
          cachedSkillRoot = dir;
          return dir;
        }
      } catch {
        /* try parent */
      }
    }
    dir = path.dirname(dir);
  }

  throw new Error(`Could not resolve ${PACKAGE_NAME} package root from ${fromModuleUrl}`);
}

export const SKILL_ROOT = resolveSkillRoot(import.meta.url);
export const BUNDLED_JS_EYES_CLIENT = path.join(SKILL_ROOT, "lib", "js-eyes-client.js");
export const BUNDLED_JS_LOGO = path.join(SKILL_ROOT, "lib", "js-logo.svg");
export const BUNDLED_TEMPLATES = path.join(SKILL_ROOT, "templates", "article");
