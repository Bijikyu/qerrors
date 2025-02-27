const { createLogger, format, transports } = require('winston');

// Create winston logger
const logger = createLogger({
	level: 'info',
	format: format.combine(
		format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		format.errors({ stack: true }),
		format.splat(),
		format.json(),
		format.printf(({ timestamp, level, message, stack }) => {
			return `${timestamp} ${level}: ${message}${stack ? '\n' + stack : ''}`;
		})
	),
	defaultMeta: { service: 'user-service' },
	transports: [
		new transports.File({ filename: 'error.log', level: 'error' }),
		new transports.File({ filename: 'combined.log' }),
		new transports.Console()
	]
});


module.exports = logger;
