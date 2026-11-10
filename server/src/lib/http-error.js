export class HttpError extends Error {
  constructor(status, detail, headers = undefined) {
    super(typeof detail === 'string' ? detail : 'HTTP error');
    this.status = status;
    this.detail = detail;
    this.headers = headers;
  }
}

export const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};
