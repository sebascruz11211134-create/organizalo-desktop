// Solo para tests en Node: el código usa imports sin extensión ("./db"), que
// Vite resuelve pero Node no. Se reintenta con ".js".
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (err) {
    if (spec.startsWith('.') && !/\.\w+$/.test(spec)) return next(spec + '.js', ctx);
    throw err;
  }
}
