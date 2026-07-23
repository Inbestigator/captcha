import { Glob } from "bun";

await Bun.build({ entrypoints: Array.from(new Glob("./src/**/*.html").scanSync()), outdir: "./public", minify: true });
