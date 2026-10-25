import { expect, test } from "bun:test";
import { usageArgs } from "./index";

test("maps the command arguments to ccusage argv", () => {
  expect(usageArgs("")).toEqual(["daily"]);
  expect(usageArgs("codex")).toEqual(["codex", "daily"]);
  expect(usageArgs("claude monthly")).toEqual(["claude", "monthly"]);
  expect(usageArgs("session pi")).toEqual(["pi", "session"]);
  expect(usageArgs("rm -rf /")).toEqual(["daily"]);
});
