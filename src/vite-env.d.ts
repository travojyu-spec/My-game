/// <reference types="vite/client" />

declare module 'virtual:embedded-assets' {
  const data: { manifest: import('./core/assets').Manifest; cg?: import('./core/assets').CgManifest; files: Record<string, string> } | null;
  export default data;
}
