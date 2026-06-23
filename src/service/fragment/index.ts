export { loadFragment } from "./loader.js";
export type {
  AstPatchDecl,
  AstPatchSelector,
  Fragment,
  FragmentMeta,
  PatchDecl,
} from "./types.js";
export { renderFragment, buildFragmentContext } from "./renderer.js";
export type { FragmentContext } from "./renderer.js";
export { patchPackageJson } from "./dep-patcher.js";
export type { PatchResult as DepPatchResult } from "./dep-patcher.js";
export { applyPatches } from "./patcher.js";
export type { PatchResult } from "./patcher.js";
export { removePatches } from "./un-patcher.js";
export type { UnPatchResult } from "./un-patcher.js";
export { removeFiles } from "./un-writer.js";
export type { UnWriteResult } from "./un-writer.js";
export { applyAstPatches } from "./ast-patcher.js";
export type { AstPatchResult } from "./ast-patcher.js";
export { removeAstPatches } from "./ast-un-patcher.js";
export type { AstUnPatchResult } from "./ast-un-patcher.js";
export {
  parseSourceFile,
  findExportedVariable,
  findImportSpecifier,
} from "./ast-parser.js";
export {
  renderHandlebars,
  renderPatch,
  renderSelector,
  renderAstPatch,
  describeSelector,
} from "./patch-render.js";
