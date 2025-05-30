# qerrors

A middleware module to log errors and analyze them via an external AI API. 
Error logger that prints error stack and AI advice in the actual logs
to resolve errors.

## Environment Variables

You will need to set OPENAI_TOKEN in your environment, get your key at [OpenAI](https://openai.com).

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

Running `npm test` uses Node's `-r` option to require `setup.js` before the
test files execute. This setup modifies Node's module path so that modules in
the `stubs` directory replace real ones. As a result, network requests and file
operations are stubbed out, allowing the test suite to run entirely offline.


