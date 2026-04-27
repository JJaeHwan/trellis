import Handlebars from "handlebars";
import type { ProjectSpec, VirtualFile, VirtualTree } from "../../domain/index.js";
import { registerHelpers, toKebab, toPascal } from "./handlebars-helpers.js";
import type { GeneratorContext, Template } from "./types.js";

const HBS_EXT = ".hbs";

export function buildContext(spec: ProjectSpec): GeneratorContext {
  const answers: Record<string, string> = {};
  for (const a of spec.answers) {
    answers[a.questionId] = a.selectedOptionId;
  }
  const generatedDate = new Date(spec.generatedAt);
  const year = Number.isNaN(generatedDate.valueOf())
    ? new Date().getUTCFullYear()
    : generatedDate.getUTCFullYear();

  return {
    projectName: spec.projectName,
    projectNameKebab: toKebab(spec.projectName),
    projectNamePascal: toPascal(spec.projectName),
    playbookId: spec.playbookId,
    year,
    generatedAt: spec.generatedAt,
    trellisVersion: spec.trellisVersion,
    answers,
  };
}

export function renderTree(
  templates: readonly Template[],
  context: GeneratorContext,
): VirtualTree {
  const hbs = Handlebars.create();
  registerHelpers(hbs);

  const result: VirtualFile[] = [];
  for (const tpl of templates) {
    if (tpl.sourcePath.endsWith(HBS_EXT)) {
      const compiled = hbs.compile(tpl.content, { noEscape: true });
      const rendered = compiled(context);
      result.push({
        path: tpl.sourcePath.slice(0, -HBS_EXT.length),
        content: rendered,
      });
    } else {
      result.push({
        path: tpl.sourcePath,
        content: tpl.content,
      });
    }
  }
  return result;
}
