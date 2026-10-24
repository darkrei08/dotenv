// Pi discovers direct .js files in the extensions directory; keep the tested
// implementation in .mjs and expose it through this default-loadable adapter.
export { default } from "./model-preflight.mjs";
export * from "./model-preflight.mjs";
