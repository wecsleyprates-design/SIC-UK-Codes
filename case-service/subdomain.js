#!/usr/bin/env node

var subdomain = "";

if (process.env.SUBDOMAIN) {
	subdomain = process.env.SUBDOMAIN;
}

if (typeof process !== "undefined") {
	console.log(process.argv[2] === "--full-url" ? `https://${subdomain}.loca.lt` : subdomain);
}

module.exports = { subdomain };
