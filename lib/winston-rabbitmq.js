'use strict';

var	util = require('util'), 
		amqp = require('amqplib'),
		winston = require('winston'),
		initializer = require('application-initializer');

var setup, connectionDetails;

function setupConnection(options) {
	if ( !setup ) {
		connectionDetails = require('amqp-connect')(options);
		setup = connectionDetails.ready.then(function() {
			return connectionDetails.defaultChannel.assertExchange(options.exchangeName, options.exchangeType);
		});

		initializer.addDependency('winston-rabbitmq', setup);
	};

	return setup;
}

var RabbitLogger = winston.transports.RabbitLogger = function(options) {
	winston.Transport.call(this, options);
	options = options || {};

	this.name = options.name || 'rabbitLogger';
	this.level = options.level || 'info';

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
	var options = {
		contentEncoding: 'utf8',
		contentType: 'text/plain',
		appId: this.amqp.applicationId,
		timestamp: new Date().getTime(),
		headers: {
			level: level
		}
	};

	connectionDetails.defaultChannel.publish(this.amqp.exchangeName, this.amqp.routingKeyPattern, new Buffer(message), options);
};

module.exports = RabbitLogger;