// Dev (`next dev`, port 3100) is unchanged. `npm run build:static` produces a static export in ./.next-static
// using a separate distDir so it never clobbers the running dev server's .next.
const STATIC = process.env.BUILD_STATIC === "1";
module.exports = { reactStrictMode: true, ...(STATIC ? { output: "export", trailingSlash: true, images: { unoptimized: true }, distDir: ".next-static" } : {}) };
