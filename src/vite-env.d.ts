/// <reference types="vite/client" />

declare module 'virtual:embedded-assets' {
  const data: { manifest: import('./core/assets').Manifest; files: Record<string, string> } | null;
  export default data;
}
