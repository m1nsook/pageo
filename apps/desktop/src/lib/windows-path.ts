/** Canonical Windows paths may contain a \\?\ prefix for OS operations.
 * Remove it only for display and clipboard; leave ordinary UNC/device names
 * and the Rust filesystem paths unchanged.
 */
export function readableLocalPath(path: string): string {
  if (path.startsWith("\\\\?\\UNC\\")) return "\\\\" + path.slice(8);
  if (/^\\\\\?\\[a-zA-Z]:\\/.test(path)) return path.slice(4);
  return path;
}
