#!/usr/bin/env node
import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  symlinkSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

const configuredAgentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), '.pi', 'agent');
const agentDir = resolve(configuredAgentDir === '~'
  ? homedir()
  : configuredAgentDir.startsWith('~/')
    ? join(homedir(), configuredAgentDir.slice(2))
    : configuredAgentDir);
const packageSkill = join(agentDir, 'npm', 'node_modules', 'gentle-pi', 'skills', 'gentle-ai');
const localSkill = join(agentDir, 'skills', 'gentle-ai');

function fail(message) {
  process.stderr.write(`ensure-pi-package-skill: ${message}\n`);
  process.exitCode = 1;
}

if (!existsSync(join(packageSkill, 'SKILL.md'))) {
  fail(`package skill is missing: ${join(packageSkill, 'SKILL.md')}`);
} else if (existsSync(localSkill) || (() => {
  try {
    lstatSync(localSkill);
    return true;
  } catch {
    return false;
  }
})()) {
  try {
    if (lstatSync(localSkill).isSymbolicLink() && realpathSync(localSkill) === realpathSync(packageSkill)) {
      process.stdout.write(`already linked ${localSkill}\n`);
    } else {
      fail(`refusing to replace existing Pi-local skill: ${localSkill}`);
    }
  } catch (error) {
    fail(`could not inspect existing Pi-local skill ${localSkill}: ${error.message}`);
  }
} else {
  mkdirSync(dirname(localSkill), { recursive: true });
  symlinkSync(relative(dirname(localSkill), packageSkill), localSkill, 'dir');
  process.stdout.write(`linked ${localSkill} -> ${packageSkill}\n`);
}
