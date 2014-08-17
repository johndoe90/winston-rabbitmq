'use strict';

var	util = require('util'), 
		amqp = require('amqplib'),
		winston = require('winston');

var connection, channel;

function setupConnection(options) {
	if ( !setupConnection.setup ) {
		var amqpUrl = util.format('amqp://%s:%s@%s:%d%s', options.username, options.password, options.host, options.port, options.virtualHost);
		setupConnection.setup = amqp.connect(amqpUrl).then(function(con) {
			connection = con;
			return connection.createChannel();
		}).then(function(ch) {
			channel = ch;
			process.once('SIGINT', teardownConnection);
			return channel.assertExchange(options.exchangeName, options.exchangeType);
		});
	};

	return setupConnection.setup;
}

function teardownConnection () {
	channel.close().finally(function() {
		connection.close()
	});
}

var RabbitLogger = winston.transports.RabbitLogger = function(options) {
	winston.Transport.call(this, options);

	options = options || {};
	options.amqp = options.amqp || {};

	this.name = options.name || 'rabbitLogger';
	this.level = options.level || 'info';

	this.amqp = {};
	this.amqp.host = options.amqp.host || 'localhost';
	this.amqp.port = options.amqp.port || 5672;
	this.amqp.username = options.amqp.username || 'guest';
	this.amqp.password = options.amqp.password || 'guest';
	this.amqp.virtualHost = options.amqp.virtualHost || '';
	this.amqp.applicationId = options.amqp.applicationId || 'noname';
	this.amqp.exchangeType = options.amqp.exchangeType || 'topic';
	this.amqp.exchangeName = options.amqp.exchangeName || 'amq.topic';
	this.amqp.routingKeyPattern = options.amqp.routingKeyPattern || (this.amqp.applicationId + '.logs');
};

util.inherits(RabbitLogger, winston.Transport);

RabbitLogger.prototype.log = function(level, message, meta, callback) {
	var settings = this.amqp;
	setupConnection(settings).then(function() {
		var options = {
			contentEncoding: 'utf8',
			contentType: 'text/plain',
			appId: settings.applicationId,
			timestamp: new Date().getTime(),
			headers: {
				level: level
			}
		};

		channel.publish(settings.exchangeName, settings.routingKeyPattern, new Buffer(message), options);
	});
};

module.exports = RabbitLogger;
		
