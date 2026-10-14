/** @type {import('next').NextConfig} */
const nextConfig = {
  // statyczny eksport do folderu out/ (Cloudflare Pages)
  output: "export",
  // @gltf-transform/core (kompresja modeli 3D przy wgrywaniu w panelu) ma też kod dla Node
  // (czytanie plików z dysku) z importami "node:fs" itp. W przeglądarce używamy tylko WebIO,
  // więc te moduły zastępujemy pustymi – inaczej webpack w Next 14 przerywa build.
  webpack: (config, { isServer, webpack }) => {
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, "");
      }),
    );
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, url: false };
    }
    return config;
  },
};

export default nextConfig;
