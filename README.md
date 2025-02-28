# qerrors

A middleware module to log errors and analyze them via an external AI API. 
Error logger that prints error stack and AI advice in the actual logs
to resolve errors.

## Environment Variables

You will need to set OPENAI_TOKEN in your environment.

## License

ISC

## Installation

```bash
npm install qerrors
```

## Usage

```javascript
// Import just qErrors (default export):
const qerrors = require('qerrors');

// OR import both qErrors and logger:
const { qerrors, logger } = require('qerrors');

// Example of using qErrors as Express middleware:
app.use((err, req, res, next) => {
	qerrors(err, 'RouteName', req, res, next);
});

// Using qErrors in any catch block:
function doFunction() {
	try {
		//code
	} catch (error) {
		qerrors(error, "doFunction", req, res, next); //req res and next are optional
	}
}

// Using the Winston logger directly:
logger.info('Application started');
logger.warn('Something might be wrong');
logger.error('An error occurred', { errorDetails: error });
```


