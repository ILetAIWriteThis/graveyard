import { readFile } from "node:fs/promises";

export async function loadProblemData(path = new URL("../public/data/problems.json", import.meta.url)) {
  const source = await readFile(path, "utf8");
  return JSON.parse(source);
}

export function validateProblemData(data) {
  const errors = [];
  const requiredStrings = ["id", "domain", "title", "summary", "model", "uncertainty", "updated"];
  if (!data || !Array.isArray(data.problems)) return ["data.problems must be an array"];
  if (!Array.isArray(data.levels) || data.levels.length !== 4) errors.push("data.levels must contain exactly four evidence levels");

  const ids = new Set();
  data.problems.forEach((problem, index) => {
    const path = `problems[${index}]`;
    requiredStrings.forEach((field) => {
      if (typeof problem[field] !== "string" || !problem[field].trim()) errors.push(`${path}.${field} must be a non-empty string`);
    });
    if (ids.has(problem.id)) errors.push(`duplicate problem id "${problem.id}"`);
    ids.add(problem.id);
    if (!Number.isInteger(problem.level) || problem.level < 1 || problem.level > 4) errors.push(`${path}.level must be an integer from 1 to 4`);
    if (!Array.isArray(problem.children)) errors.push(`${path}.children must be an array`);
    if (!Array.isArray(problem.related)) errors.push(`${path}.related must be an array`);
    if (!Array.isArray(problem.concepts)) errors.push(`${path}.concepts must be an array`);
  });

  const byId = new Map(data.problems.map((problem) => [problem.id, problem]));
  const parentCount = new Map(data.problems.map((problem) => [problem.id, 0]));
  data.problems.forEach((problem, index) => {
    problem.children?.forEach((childId, childIndex) => {
      if (!byId.has(childId)) errors.push(`problems[${index}].children[${childIndex}] references unknown problem "${childId}"`);
      else parentCount.set(childId, parentCount.get(childId) + 1);
      if (childId === problem.id) errors.push(`problem "${problem.id}" cannot contain itself`);
    });
    problem.related?.forEach((relation, relationIndex) => {
      if (!relation || typeof relation !== "object") {
        errors.push(`problems[${index}].related[${relationIndex}] must be an object`);
        return;
      }
      if (!byId.has(relation.id)) errors.push(`problems[${index}].related[${relationIndex}] references unknown problem "${relation.id}"`);
      if (relation.id === problem.id) errors.push(`problem "${problem.id}" cannot relate to itself`);
      if (typeof relation.reason !== "string" || !relation.reason.trim()) errors.push(`relation from "${problem.id}" to "${relation.id}" needs a reason`);
    });
  });

  const visiting = new Set();
  const visited = new Set();
  const visit = (id, path = []) => {
    if (visiting.has(id)) {
      errors.push(`containment cycle: ${[...path, id].join(" → ")}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    byId.get(id)?.children.forEach((childId) => visit(childId, [...path, id]));
    visiting.delete(id);
    visited.add(id);
  };
  data.problems.forEach((problem) => visit(problem.id));

  data.problems.forEach((problem) => {
    const navigable = parentCount.get(problem.id) > 0 || problem.children.length > 0 || problem.related.length > 0;
    if (!navigable) errors.push(`problem "${problem.id}" is a dead end; add a parent, subproblem, or relation`);
  });
  return [...new Set(errors)];
}
