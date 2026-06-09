import { useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { spriteWithFallback } from '../game/utils/spriteUrl'
import styles from './PokemonSprite.module.css'

interface Props {
  id: number
  shiny?: boolean
  flip?: boolean
  paused?: boolean
  style?: CSSProperties
  className?: string
  imgRef?: React.Ref<HTMLImageElement>
}

export function PokemonSprite({ id, shiny = false, flip = false, paused = false, style, className, imgRef }: Props) {
  const { webm, fallback } = spriteWithFallback(id, shiny)
  const [useFallback, setUseFallback] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => { setUseFallback(false) }, [id])

  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return
    if (paused) vid.pause()
    else vid.play().catch(() => {/* autoplay policy */})
  }, [paused])

  const baseStyle: CSSProperties = {
    imageRendering: 'auto',
    ...style,
    ...(flip ? { transform: 'scaleX(-1)' } : {}),
  }

  const sprite = useFallback ? (
    <img
      key={id}
      ref={imgRef}
      src={fallback}
      alt=""
      draggable={false}
      className={className}
      style={baseStyle}
    />
  ) : (
    <video
      key={id}
      ref={videoRef}
      autoPlay
      loop
      muted
      playsInline
      disablePictureInPicture
      draggable={false}
      className={className}
      style={baseStyle}
      onError={() => setUseFallback(true)}
    >
      <source src={webm} type="video/webm" onError={() => setUseFallback(true)} />
    </video>
  )

  if (!shiny) return sprite

  return (
    <span className={styles.wrap}>
      {sprite}
      <span className={styles.shinyBadge}>★</span>
    </span>
  )
}
