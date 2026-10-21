export const hasWebGL2 = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return gl !== null;
  } catch {
    return false;
  }
})();

export const isWebGLError = (error: unknown) => error instanceof Error && /webgl/i.test(error.message);
