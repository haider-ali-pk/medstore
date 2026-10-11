// Express 4 does not forward errors from async route handlers, which crashed the whole server.
// This makes any rejected promise go to the error handler instead.
const Layer = require("express/lib/router/layer");
Layer.prototype.handle_request = function handle(req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return next();
  try {
    const out = fn(req, res, next);
    if (out && typeof out.catch === "function") out.catch(next);
  } catch (err) {
    next(err);
  }
};
