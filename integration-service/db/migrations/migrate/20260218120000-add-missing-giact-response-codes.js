"use strict";

var dbm;
var type;
var seed;
var fs = require("fs");
var path = require("path");
var Promise;

/**
 * Add missing GIACT response codes to integrations.core_giact_response_codes.
 * Sources: AccountResponseCode (gVerify), CustomerResponseCode (gAuthenticate) from GIACT API.
 * Does not modify existing rows.
 */
exports.setup = function (options, seedLink) {
	dbm = options.dbmigrate;
	type = dbm.dataType;
	seed = seedLink;
	Promise = options.Promise;
};

exports.up = function (db) {
	var filePath = path.join(__dirname, "sqls", "20260218120000-add-missing-giact-response-codes-up.sql");
	return new Promise(function (resolve, reject) {
		fs.readFile(filePath, { encoding: "utf-8" }, function (err, data) {
			if (err) return reject(err);
			resolve(data);
		});
	}).then(function (data) {
		return db.runSql(data);
	});
};

exports.down = function (db) {
	var filePath = path.join(__dirname, "sqls", "20260218120000-add-missing-giact-response-codes-down.sql");
	return new Promise(function (resolve, reject) {
		fs.readFile(filePath, { encoding: "utf-8" }, function (err, data) {
			if (err) return reject(err);
			resolve(data);
		});
	}).then(function (data) {
		return db.runSql(data);
	});
};

exports._meta = {
	version: 1
};
