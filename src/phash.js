// Perceptual-hash helpers used by SimilarityContext for photo similarity search.

export const PHASH_CACHE_KEY = 'br_phash_cache'
export const GLOBAL_SIM_CAP = 2000

export async function computePHash(imgUrl) {
  const proxied = `/api/proxy-image?url=${encodeURIComponent(imgUrl)}`
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 8; canvas.height = 8
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, 8, 8)
        const data = ctx.getImageData(0, 0, 8, 8).data
        const grays = []
        for (let i = 0; i < 64; i++) grays.push((data[i*4] + data[i*4+1] + data[i*4+2]) / 3)
        const avg = grays.reduce((a, b) => a + b) / 64
        resolve(grays.map(g => g >= avg ? 1 : 0))
      } catch (e) { reject(e) }
    }
    img.onerror = reject
    img.src = proxied
  })
}
export function hammingDistance(a, b) {
  return a.reduce((d, v, i) => d + (v !== b[i] ? 1 : 0), 0)
}
