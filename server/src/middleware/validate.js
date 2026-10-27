export const validate = (schema, source = 'body') => (req, _res, next) => {
  const parsed = schema.parse(req[source]);
  if (source === 'query') {
    // Express 5 exposes req.query through a prototype getter without a setter.
    // Define the validated/coerced value on this request instance instead.
    Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true, enumerable: true });
  } else {
    req[source] = parsed;
  }
  next();
};
