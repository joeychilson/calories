type LogData = Record<string, unknown>;

export const logger = {
	info: (message: string, data?: LogData) => log('info', message, data),
	warn: (message: string, data?: LogData) => log('warn', message, data),
	error: (message: string, data?: LogData) => log('error', message, data),
	debug: (message: string, data?: LogData) => log('debug', message, data)
};

function log(level: string, message: string, data?: LogData): void {
	console.log(
		JSON.stringify({
			timestamp: new Date().toISOString(),
			level,
			message,
			...data
		})
	);
}

export function generateRequestId(): string {
	return Math.random().toString(36).substring(2, 10);
}

interface RequestLogData {
	requestId: string;
	method: string;
	path: string;
	status: number;
	duration: number;
	userId?: string;
}

export function logRequest(data: RequestLogData): void {
	logger.info('request', { ...data });
}

interface ErrorLogData {
	requestId: string;
	method: string;
	path: string;
	userId?: string;
	error: unknown;
}

export function logError(data: ErrorLogData): void {
	const { error: err, ...rest } = data;
	let errorMessage: string;
	let stack: string | undefined;

	if (err instanceof Error) {
		errorMessage = err.message;
		stack = err.stack;
	} else if (err && typeof err === 'object') {
		errorMessage = JSON.stringify(err);
	} else {
		errorMessage = String(err);
	}

	logger.error('request_error', {
		...rest,
		error: errorMessage,
		stack
	});
}
