/**
 * Retry policy for queries whose failure is an answer, not a hiccup.
 *
 * The api-client encodes the status into the message as `ERR_<status>`.
 * Anything in the 4xx range means the server understood the request and
 * refused it: 401 wants a login, 403 wants a role, 402 wants a plan. Asking
 * again changes nothing.
 *
 * This is not only wasted work. A query that is still retrying reports
 * `status: "pending"`, so the page keeps rendering skeletons instead of the
 * refusal — which is exactly how a locked module ended up looking like a
 * page that never loads.
 */
export function retryUnlessClientError(failureCount: number, error: unknown) {
  if (error instanceof Error && /\bERR_4\d\d\b/.test(error.message)) return false
  return failureCount < 1
}
