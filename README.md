# My Error Logger

A middleware module to log errors and analyze them via an external AI API. 
Error logger that prints error stack and AI advice in the actual logs
to resolve errors.

## Environment Variables

You will need to set OPENAI_TOKEN in your environment.

## License

ISC

## Installation

```bash
npm install qerrorLogger
```

## Usage

```
const qerrorLogger = require('qerrorLogger');

// Example of using qerrorLogger as Express middleware:
app.use((err, req, res, next) => {
	qerrorLogger(err, 'RouteName', req, res, next);
});

// you can also put it in any catch block:
function doFunction () {
	try {
		//code
	} catch (error) {
		qerrorLogger(error, "do function", req, res, next); //req res and next are optional
	}
}
```


