declare module 'zod' {
  // Minimal shim for typechecking in workspaces without resolving node_modules from shared/
  export const z: any;
  const _default: any;
  export default _default;
}

