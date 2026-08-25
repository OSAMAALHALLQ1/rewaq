/**
 * Limits post-authentication navigation to local application paths.
 */
export function getSafeAuthCallbackNext(nextParam: string | null) {
  if (
    nextParam &&
    nextParam.startsWith("/") &&
    !nextParam.startsWith("//") &&
    !nextParam.includes("\\")
  ) {
    return nextParam;
  }

  return "/dashboard";
}
