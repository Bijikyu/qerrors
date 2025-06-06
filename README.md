# qerrors

A middleware module to log errors and analyze them via an external AI API. 
Error logger that prints error stack and AI advice in the actual logs
to resolve errors.

## Environment Variables

You will need to set OPENAI_TOKEN in your environment, get your key at [OpenAI](https://openai.com).
You can optionally set `QERRORS_CACHE_LIMIT` to adjust how many advice entries are cached; the default is 50.

Additional options control the logger's file rotation:

* `QERRORS_LOG_MAXSIZE` - max log file size in bytes before rotation (default `1048576`)
* `QERRORS_LOG_MAXFILES` - number of rotated files to keep (default `5`)

## License

ISC

## Installation

```bash
npm install qerrors
```

## Usage

```javascript
// Import just qerrors:
const {qerrors} = require('qerrors');
// OR import both qerrors and logger: //(changed qErrors to qerrors for casing consistency)
const { qerrors, logger } = require('qerrors');

// Example of using qerrors as Express middleware:
app.use((err, req, res, next) => {
	qerrors(err, 'RouteName', req, res, next);
});

// Using qerrors in any catch block:
function doFunction(req, res, next) {
	try {
		//code
	} catch (error) {
		qerrors(error, "doFunction", req, res, next); //req res and next are optional
	}
}

// Example for javascript that is not express related (node / service code / biz logic)
function doFunction(param) {
	try {
		//code
	} catch (error) {
		qerrors(error, "doFunction", param);
	}
}

// ... or if multiple params:
function doFunction(param1, param2) {
	try {
		//code
	} catch (error) {
		qerrors(error, "doFunction", {param1, param2}); 
	}
}

// Using the Winston logger directly:
logger.info('Application started');
logger.warn('Something might be wrong');
logger.error('An error occurred', { errorDetails: error });
```

## Testing

Running `npm test` starts Node's built-in test runner using the `--test` flag.
The included tests rely on the `qtests` library to stub network requests, so the
suite can run entirely offline.


