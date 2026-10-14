// Vercel Serverless Function Bridge
// Forwards invocations to compiled TypeScript distribution
const serverApp = require('./dist/index.js');
module.exports = serverApp.default || serverApp;
