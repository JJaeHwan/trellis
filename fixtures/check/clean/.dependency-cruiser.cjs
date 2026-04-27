module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "L0-no-upper",
      severity: "error",
      from: { path: "^src/common" },
      to: { path: "^src/(config|domain|external|service|cmd)(/|$)" },
    },
    {
      name: "L4-no-upper",
      severity: "error",
      from: { path: "^src/service" },
      to: { path: "^src/cmd(/|$)" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
  },
};
