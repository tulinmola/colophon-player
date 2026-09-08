export function fileNameFrom(url) {
  const { pathname } = new URL(url, document.baseURI)

  return pathname.slice(pathname.lastIndexOf("/") + 1)
}
