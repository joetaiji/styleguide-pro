// 이미지 저장소
const imageStore: Record<string, string> = {}

export const imageMimeTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
}

export function storeImage(path: string, dataUrl: string): void {
  const normalized = path.replace(/\\/g, '/')
  const fileName = normalized.split('/').pop() || ''

  imageStore[path] = dataUrl
  imageStore[normalized] = dataUrl
  imageStore[fileName] = dataUrl
  imageStore['./' + normalized] = dataUrl
  imageStore['../' + normalized] = dataUrl

  const parts = normalized.split('/')
  for (let i = 0; i < parts.length; i++) {
    const partial = parts.slice(i).join('/')
    imageStore[partial] = dataUrl
    imageStore['/' + partial] = dataUrl
    imageStore['./' + partial] = dataUrl
    imageStore['../' + partial] = dataUrl
  }
}

export function findImageInStore(path: string): string | null {
  if (imageStore[path]) return imageStore[path]

  const normalized = path.replace(/\\/g, '/').replace(/^\.\.?\//, '')
  if (imageStore[normalized]) return imageStore[normalized]

  const fileName = path.split('/').pop()?.split('\\').pop() || ''
  if (imageStore[fileName]) return imageStore[fileName]

  for (const [storedPath, dataUrl] of Object.entries(imageStore)) {
    if (
      storedPath.endsWith(normalized) ||
      normalized.endsWith(storedPath.replace(/^\.\.?\//, ''))
    ) {
      return dataUrl
    }
  }

  return null
}

export function replaceImagePaths(content: string): string {
  if (Object.keys(imageStore).length === 0) return content

  let result = content

  // src="경로" 패턴
  result = result.replace(
    /src=["']([^"']+\.(jpg|jpeg|png|gif|svg|webp|ico|bmp))["']/gi,
    (match, path) => {
      const dataUrl = findImageInStore(path)
      return dataUrl ? `src="${dataUrl}"` : match
    }
  )

  // url(경로) 패턴
  result = result.replace(
    /url\(["']?([^"')]+\.(jpg|jpeg|png|gif|svg|webp|ico|bmp))["']?\)/gi,
    (match, path) => {
      const dataUrl = findImageInStore(path)
      return dataUrl ? `url("${dataUrl}")` : match
    }
  )

  return result
}

export function clearImageStore(): void {
  Object.keys(imageStore).forEach((key) => delete imageStore[key])
}

export function getImageStoreSize(): number {
  return Object.keys(imageStore).length
}
