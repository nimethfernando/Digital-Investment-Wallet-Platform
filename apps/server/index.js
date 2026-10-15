// Vercel Serverless Function & Service Entrypoint Bridge
let app;
let initError = null;

try {
  const serverApp = require('./dist/index.js');
  app = serverApp.app || serverApp.default || serverApp;
} catch (err) {
  console.error('[Vercel Boot Error]:', err);
  initError = err;
}

// In Vercel Services mode, listen on process.env.PORT
if (process.env.PORT && app && !app.listening) {
  try {
    const port = process.env.PORT;
    app.listen(port, () => {
      console.log(`[Vercel Service] Avora API running on port ${port}`);
    });
  } catch (e) {}
}

// In Vercel Serverless Function mode, export standard handler
module.exports = (req, res) => {
  if (initError || !app) {
    return res.status(500).json({
      success: false,
      error: 'Serverless Boot Failure',
      message: initError ? initError.message : 'Application failed to initialize',
      stack: initError ? initError.stack : undefined,
    });
  }
  return app(req, res);
};

module.exports.default = module.exports;
module.exports.app = app;
