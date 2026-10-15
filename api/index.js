// Universal Root Vercel Serverless Function Bridge
let app;
let initError = null;

try {
  const serverApp = require('../apps/server/dist/index.js');
  app = serverApp.app || serverApp.default || serverApp;
} catch (err) {
  try {
    const serverApp = require('./apps/server/dist/index.js');
    app = serverApp.app || serverApp.default || serverApp;
  } catch (err2) {
    console.error('[Root Vercel Boot Error]:', err2);
    initError = err2;
  }
}

module.exports = (req, res) => {
  if (initError || !app) {
    return res.status(500).json({
      success: false,
      error: 'Root Serverless Boot Failure',
      message: initError ? initError.message : 'Application failed to initialize',
      stack: initError ? initError.stack : undefined,
    });
  }
  return app(req, res);
};

module.exports.default = module.exports;

