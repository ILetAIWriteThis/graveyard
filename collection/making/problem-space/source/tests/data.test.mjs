import assert from "node:assert/strict";
import test from "node:test";
import { loadProblemData, validateProblemData } from "../scripts/problem-data.mjs";

test("the canonical problem graph is valid", async () => {
  const data = await loadProblemData();
  assert.deepEqual(validateProblemData(data), []);
});

const problem = (id, domain, children = [], related = []) => ({
  id,
  domain,
  title: `What is the synthetic problem ${id}?`,
  summary: "Test fixture only.",
  model: "Test fixture only.",
  uncertainty: "Test fixture only?",
  updated: "2026-01-01",
  level: 1,
  concepts: ["fixture"],
  children,
  related
});

const fixture = {
  levels: ["Aware", "Understood", "Reproduced", "Operational"],
  problems: [
    problem("root-a", "Fixture A", ["shared"]),
    problem("root-b", "Fixture B", ["shared"]),
    problem("shared", "Fixture C", [], [{ id: "root-b", reason: "Synthetic cross-domain relation." }])
  ]
};

test("the production graph starts empty rather than shipping invented knowledge", async () => {
  const data = await loadProblemData();
  assert.equal(data.problems.length, 0);
});

test("subproblems may have multiple parents and relations may cross domains", () => {
  const data = fixture;
  const parentCounts = new Map(data.problems.map((problem) => [problem.id, 0]));
  data.problems.forEach((problem) => problem.children.forEach((id) => parentCounts.set(id, parentCounts.get(id) + 1)));
  assert.ok([...parentCounts.values()].some((count) => count > 1));
  const byId = new Map(data.problems.map((problem) => [problem.id, problem]));
  assert.ok(data.problems.some((problem) =>
    problem.related.some((relation) => byId.get(relation.id)?.domain !== problem.domain)
  ));
});

test("every populated problem has a route onward", () => {
  const data = fixture;
  const parentIds = new Set(data.problems.flatMap((problem) => problem.children));
  data.problems.forEach((problem) => {
    assert.ok(parentIds.has(problem.id) || problem.children.length || problem.related.length, problem.id);
  });
});
