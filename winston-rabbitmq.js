'use strict';

var	util = require('util'), 
		amqp = require('amqplib'),
		winston = require('winston');

var setup, connection, channel;

function setupConnection (options) {
	if ( !setup ) {
		var amqpUrl = util.format('amqp://%s:%s@%s:%d%s', options.username, options.password, options.host, options.port, options.virtualHost);
		setup = amqp.connect(amqpUrl).then(function(con) {
			connection = con;
			return connection.createChannel();
		}).then(function(ch) {
			channel = ch;
			process.once('SIGINT', teardownConnection);
			return channel.assertExchange(options.exchangeName, options.exchangeType);
		});
	};

	return setup;
}

function teardownConnection () {
	channel.close().then(function() {
		connection.close()
	});
}

var RabbitLogger = winston.transports.RabbitLogger = function(options) {
	options = options || {};
	options.amqp = options.amqp || {};

	this.name = 'rabbitLogger';
	this.level = options.level || 'info';
	this.amqp = {
		host: options.host || 'localhost',
		port: options.amqp.port || 5672,
		username: options.amqp.username || 'guest',
		password: options.amqp.password || 'guest',
		virtualHost: options.amqp.virtualHost || '',

		exchangeName: options.amqp.exchangeName || 'amq.topic',
		exchangeType: options.amqp.exchangeType || 'topic',
		routingKeyPattern: options.amqp.routingKeyPattern || 'mymessages',

		applicationId: options.amqp.applicationId || ''
	};
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
		
