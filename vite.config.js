import { defineConfig } from "vite";

// Injeta as seções, a navegação e a marca no index.html a partir de src/data.js.
// No dev, carrega via ssrLoadModule para refletir edições sem reiniciar.
const sections = () => {
  let server;
  return {
    name: "render-sections",
    configureServer(s) { server = s; },
    async transformIndexHtml(html) {
      const { renderSections, renderNav, renderMark } = server
        ? await server.ssrLoadModule("/src/render.js")
        : await import("./src/render.js");
      return html
        .replace('<main id="conteudo"></main>', `<main id="conteudo">${renderSections()}</main>`)
        .replace('<nav class="nav" id="nav" aria-label="Seções"></nav>', `<nav class="nav" id="nav" aria-label="Seções">${renderNav()}</nav>`)
        .replaceAll("<!--MARK-->", renderMark());
    },
    handleHotUpdate({ file, server: s }) {
      if (/src[\\/](data|render|stops)\.js$/.test(file)) s.ws.send({ type: "full-reload" });
    },
  };
};

export default defineConfig({
  base: "./",
  plugins: [sections()],
  // não herdar o postcss.config da pasta-pai
  css: { postcss: {} },
  server: { port: 5173, open: false },
  build: { target: "es2022", chunkSizeWarningLimit: 900 },
});
