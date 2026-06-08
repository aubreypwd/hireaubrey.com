// src/_data/env.js
module.exports = {
	isProduction: process.env.CONTEXT === 'production',
	isBuilding: process.env.ELEVENTY_RUN_MODE === 'build',
	context: process.env.CONTEXT
};