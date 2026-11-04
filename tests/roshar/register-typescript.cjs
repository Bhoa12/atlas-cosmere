const fs = require('node:fs');
const ts = require('typescript');

// Keep the test suite dependency-free: Node's built-in runner executes tests,
// while TypeScript's already-installed compiler transpiles the pure domain modules.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;
  module._compile(output, filename);
};
