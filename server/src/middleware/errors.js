import { ZodError } from 'zod';

function zodDetail(error) {
  return error.issues.map((issue) => ({
    type: `value_error.${issue.code}`,
    loc: ['body', ...issue.path],
    msg: issue.message,
    input: undefined,
  }));
}

export function notFound(_request, response) {
  response.status(404).json({ detail: 'Not Found' });
}

export function errorHandler(error, _request, response, _next) {
  if (error instanceof ZodError) return response.status(422).json({ detail: zodDetail(error) });
  const status = Number(error.status || error.statusCode || 500);
  if (error.headers) for (const [name, value] of Object.entries(error.headers)) response.setHeader(name, value);
  if (status >= 500) console.error('Request failed', { name: error.name, message: error.message });
  return response.status(status).json({ detail: error.detail ?? (status >= 500 ? 'Internal Server Error' : error.message) });
}
