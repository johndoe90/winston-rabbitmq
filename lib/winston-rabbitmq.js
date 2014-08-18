'use strict';

var	util = require('util'), 
		amqp = require('amqplib'),
		winston = require('winston'),
		initializer = require('application-initializer');

var setup, connectionDetails;

var setupConnection = function(options) {
	if ( !setup ) {
		connectionDetails = require('amqp-connect')(options);
		setup = connectionDetails.ready.then(function() {
			return connectionDetails.defaultChannel.assertExchange(options.exchangeName, options.exchangeType);
		});

		initializer.addDependency('winston-rabbitmq', setup);
	};

	return setup;
};

var defaultTransformer = function(level, message, meta) {
	return { text: message, meta: meta };
};

var RabbitLogger = winston.transports.RabbitLogger = function(options) {
	winston.Transport.call(this, options);
	options = options || {};

	this.name = options.name || 'rabbitLogger';
	this.level = options.level || 'info';
	this.messageTransformer = options.messageTransformer || defaultTransformer;

	this.amqp = {};
	this.amqp.host = options.host || 'localhost';
	this.amqp.port = options.port || 5672;
	this.amqp.username = options.username || 'guest';
	this.amqp.password = options.password || 'guest';
	this.amqp.virtualHost = options.virtualHost || '';
	this.amqp.applicationId = options.applicationId || 'noname';
	this.amqp.exchangeType = options.exchangeType || 'topic';
	this.amqp.exchangeName = options.exchangeName || 'amq.topic';
	this.amqp.routingKeyPattern = options.routingKeyPattern || (this.amqp.applicationId + '.logs');

	setupConnection(this.amqp);
};

util.inherits(RabbitLogger, winston.Transport);

RabbitLogger.prototype.log = function(level, message, meta, callback) {
	var properties = {
		contentEncoding: 'utf8',
		contentType: 'application/json',
		appId: this.amqp.applicationId,
		timestamp: new Date().getTime(),
		headers: {
			level: level
		}
	};

	var data = new Buffer(JSON.stringify(this.messageTransformer(level, message, meta)));

	connectionDetails.defaultChannel.publish(this.amqp.exchangeName, this.amqp.routingKeyPattern, data, properties);
	callback(null, true);
};

module.exports = RabbitLogger;