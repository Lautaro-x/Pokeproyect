const OFFICIAL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork'

export function officialArtwork(id: number): string {
  return `${OFFICIAL}/${id}.png`
}

// Sprite local descargado de Wikidex (en public/sprites/)
export function localSprite(id: number, shiny = false): string {
  return `/sprites/${id}_${shiny ? 'shiny' : 'normal'}.webm`
}

// Decide si usar el WebM local o el fallback PNG
// Uso: <SpriteImage id={6} shiny={false} />
export function spriteWithFallback(id: number, shiny = false) {
  return {
    webm: localSprite(id, shiny),
    fallback: officialArtwork(id),
  }
}
