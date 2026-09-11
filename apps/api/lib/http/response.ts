export function json<T>(data: T, init?: ResponseInit) {
  return Response.json(data, init);
}
