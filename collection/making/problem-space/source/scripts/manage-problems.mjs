import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadProblemData, validateProblemData } from "./problem-data.mjs";

const dataPath = fileURLToPath(new URL("../public/data/problems.json", import.meta.url));
const checksumPath = fileURLToPath(new URL("../public/data/problems.sha256", import.meta.url));
const command = process.argv[2] || "help";
const rawArgs = process.argv.slice(3);

function parseArgs(values) {
  const positional = [];
  const flags = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const name = value.slice(2);
    const next = values[index + 1];
    const flagValue = next && !next.startsWith("--") ? values[++index] : true;
    const existing = flags.get(name) || [];
    flags.set(name, [...existing, flagValue]);
  }
  return { positional, flags };
}

const args = parseArgs(rawArgs);
const one = (name) => args.flags.get(name)?.at(-1);
const many = (name) => (args.flags.get(name) || []).filter((value) => value !== true);
const required = (name) => {
  const value = one(name);
  if (typeof value !== "string" || !value.trim()) throw new Error(`--${name} is required`);
  return value.trim();
};
const existingProblem = (data, id) => {
  const problem = data.problems.find((candidate) => candidate.id === id);
  if (!problem) throw new Error(`Unknown problem "${id}"`);
  return problem;
};
const digest = (content) => createHash("sha256").update(content).digest("hex");

async function save(data) {
  const errors = validateProblemData(data);
  if (errors.length) throw new Error(`Invalid problem graph:\n- ${errors.join("\n- ")}`);
  const content = `${JSON.stringify(data, null, 2)}\n`;
  const checksum = `${digest(content)}\n`;
  const suffix = `.${process.pid}.${Date.now()}.tmp`;
  const dataTemp = `${dataPath}${suffix}`;
  const checksumTemp = `${checksumPath}${suffix}`;
  await Promise.all([writeFile(dataTemp, content), writeFile(checksumTemp, checksum)]);
  await rename(dataTemp, dataPath);
  await rename(checksumTemp, checksumPath);
}

async function mutate(change) {
  const data = await loadProblemData();
  await change(data);
  await save(data);
}

function help() {
  console.log(`Problem Space graph manager

Usage:
  npm run problems -- <command> [arguments]

Read:
  help
  check
  list
  show <id>

Problems:
  add <id> --domain <name> --title <question> --summary <text>
      --model <text> --uncertainty <question> [--level 1-4]
      [--concept <name> ...] [--accent <css-color>]
  update <id> [--domain ...] [--title ...] [--summary ...]
      [--model ...] [--uncertainty ...] [--level 1-4]
      [--concept <name> ...] [--accent <css-color>] [--clear-accent]
  remove <id>

Edges:
  contain <parent-id> <child-id>
  uncontain <parent-id> <child-id>
  relate <source-id> <target-id> --reason <why-they-connect>
  unrelate <source-id> <target-id>

Examples:
  npm run problems -- add hard-question --domain "Life" \
    --title "What makes this problem worth keeping?" \
    --summary "The tension in one sentence." \
    --model "The current mental model." \
    --uncertainty "What remains unclear?" \
    --concept judgment
  npm run problems -- contain root-problem hard-question
  npm run problems -- relate hard-question another-problem \
    --reason "Both depend on the same hidden constraint."

Every mutation validates the entire graph and updates its checksum.`);
}

async function check() {
  const [data, content, expected] = await Promise.all([
    loadProblemData(),
    readFile(dataPath, "utf8"),
    readFile(checksumPath, "utf8")
  ]);
  const errors = validateProblemData(data);
  if (expected.trim() !== digest(content)) errors.push("public/data/problems.sha256 does not match problems.json");
  if (errors.length) throw new Error(`Invalid problem graph:\n- ${errors.join("\n- ")}`);
  const edges = data.problems.reduce((total, problem) => total + problem.children.length + problem.related.length, 0);
  console.log(`Valid problem graph: ${data.problems.length} problems, ${edges} canonical edges.`);
}

async function main() {
  if (command === "help") return help();
  if (command === "check") return check();

  if (command === "list") {
    const data = await loadProblemData();
    if (!data.problems.length) return console.log("No canonical problems yet.");
    data.problems.forEach((problem) => console.log(`${problem.id}\tL${problem.level}\t${problem.domain}\t${problem.title}`));
    return;
  }

  if (command === "show") {
    const data = await loadProblemData();
    console.log(JSON.stringify(existingProblem(data, args.positional[0]), null, 2));
    return;
  }

  if (command === "add") {
    const id = args.positional[0];
    if (!id) throw new Error("Problem id is required");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error("Problem id must be lowercase kebab-case");
    await mutate((data) => {
      if (data.problems.some((problem) => problem.id === id)) throw new Error(`Problem "${id}" already exists`);
      const level = Number(one("level") || 1);
      const problem = {
        id,
        domain: required("domain"),
        title: required("title"),
        summary: required("summary"),
        model: required("model"),
        uncertainty: required("uncertainty"),
        level,
        updated: new Date().toISOString().slice(0, 10),
        concepts: [...new Set(many("concept").map((value) => value.trim()).filter(Boolean))],
        children: [],
        related: []
      };
      const accent = one("accent");
      if (typeof accent === "string") problem.accent = accent.trim();
      data.problems.push(problem);
    });
    console.log(`Added problem "${id}".`);
    return;
  }

  if (command === "update") {
    const id = args.positional[0];
    await mutate((data) => {
      const problem = existingProblem(data, id);
      ["domain", "title", "summary", "model", "uncertainty", "accent"].forEach((field) => {
        const value = one(field);
        if (typeof value === "string") problem[field] = value.trim();
      });
      if (one("level") !== undefined) problem.level = Number(one("level"));
      if (args.flags.has("concept")) problem.concepts = [...new Set(many("concept").map((value) => value.trim()).filter(Boolean))];
      if (one("clear-accent") === true) delete problem.accent;
      problem.updated = new Date().toISOString().slice(0, 10);
    });
    console.log(`Updated problem "${id}".`);
    return;
  }

  if (command === "remove") {
    const id = args.positional[0];
    await mutate((data) => {
      existingProblem(data, id);
      const references = data.problems.filter((problem) =>
        problem.children.includes(id) || problem.related.some((relation) => relation.id === id)
      );
      if (references.length) throw new Error(`Problem "${id}" is still referenced by: ${references.map((problem) => problem.id).join(", ")}`);
      data.problems = data.problems.filter((problem) => problem.id !== id);
    });
    console.log(`Removed problem "${id}".`);
    return;
  }

  if (["contain", "uncontain"].includes(command)) {
    const [parentId, childId] = args.positional;
    await mutate((data) => {
      const parent = existingProblem(data, parentId);
      existingProblem(data, childId);
      if (command === "contain" && !parent.children.includes(childId)) parent.children.push(childId);
      if (command === "uncontain") parent.children = parent.children.filter((id) => id !== childId);
      parent.updated = new Date().toISOString().slice(0, 10);
    });
    console.log(`${command === "contain" ? "Connected" : "Disconnected"} "${parentId}" → "${childId}".`);
    return;
  }

  if (["relate", "unrelate"].includes(command)) {
    const [sourceId, targetId] = args.positional;
    await mutate((data) => {
      const source = existingProblem(data, sourceId);
      existingProblem(data, targetId);
      if (command === "relate") {
        const reason = required("reason");
        const existing = source.related.find((relation) => relation.id === targetId);
        if (existing) existing.reason = reason;
        else source.related.push({ id: targetId, reason });
      } else {
        source.related = source.related.filter((relation) => relation.id !== targetId);
      }
      source.updated = new Date().toISOString().slice(0, 10);
    });
    console.log(`${command === "relate" ? "Related" : "Unrelated"} "${sourceId}" → "${targetId}".`);
    return;
  }

  throw new Error(`Unknown command "${command}". Run "npm run problems -- help".`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
