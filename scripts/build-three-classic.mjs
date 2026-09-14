import { readFile, writeFile } from "node:fs/promises";

const corePath = new URL("../vendor/three.core.js", import.meta.url);
const modulePath = new URL("../vendor/three.module.js", import.meta.url);
const outputPath = new URL("../vendor/three.classic.js", import.meta.url);

const stripModuleSyntax = (source) => source
  .replace(/^import \{.*\} from ['"].*['"];\n?/gm, "")
  .replace(/^export \{.*\n?/gm, "");

const [core, renderer] = await Promise.all([
  readFile(corePath, "utf8"),
  readFile(modulePath, "utf8"),
]);

const publicNames = [
  "BoxGeometry",
  "ClampToEdgeWrapping",
  "DirectionalLight",
  "DoubleSide",
  "DynamicDrawUsage",
  "Group",
  "HemisphereLight",
  "MathUtils",
  "Mesh",
  "MeshBasicMaterial",
  "MeshStandardMaterial",
  "NoToneMapping",
  "PCFSoftShadowMap",
  "PerspectiveCamera",
  "PlaneGeometry",
  "Scene",
  "SRGBColorSpace",
  "TextureLoader",
  "WebGLRenderer",
];

const importMatch = renderer.match(
  /^import \{ (.*) \} from ['"]\.\/three\.core\.js['"];/m
);

if (!importMatch) throw new Error("Could not find the Three.js core import list.");

const rendererImports = importMatch[1]
  .split(",")
  .map((name) => name.trim());
const coreNames = [...new Set([
  ...rendererImports,
  ...publicNames.filter((name) => name !== "WebGLRenderer"),
])];

const bundle = `/* Generated from the vendored Three.js ES modules. */
(function (globalThis) {
const THREECore = (function () {
${stripModuleSyntax(core)}
return { ${coreNames.join(", ")} };
})();
const THREERenderer = (function () {
const { ${rendererImports.join(", ")} } = THREECore;
${stripModuleSyntax(renderer)}
return { WebGLRenderer };
})();
globalThis.THREE = Object.freeze({ ...THREECore, ...THREERenderer });
})(globalThis);
`;

await writeFile(outputPath, bundle);
