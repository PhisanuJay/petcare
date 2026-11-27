class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function sendError(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

function errorMiddleware(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof HttpError) {
    sendError(res, err.status, err.code, err.message);
    return;
  }
  if (err.name === 'ZodError') {
    const message = err.issues.map((issue) => issue.message).join(' ');
    sendError(res, 400, 'BAD_INPUT', message || 'ข้อมูลไม่ถูกต้อง');
    return;
  }
  console.error(err && err.stack ? err.stack.split('\n').slice(0, 4).join('\n') : 'unexpected error');
  sendError(res, 500, 'INTERNAL', 'ระบบขัดข้อง ลองใหม่ภายหลัง');
}

module.exports = { HttpError, asyncHandler, errorMiddleware };
