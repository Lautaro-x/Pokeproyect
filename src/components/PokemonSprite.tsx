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
  // When the className gives the element a fixed/percentage size (e.g. width:100%),
  // set shinyFill so the inner video also fills the span at 100%.
  // Without it the inner video uses auto sizing (safe for auto-width containers).
  shinyFill?: boolean
}

export function PokemonSprite({ id, shiny = false, flip = false, paused = false, style, className, imgRef, shinyFill = false }: Props) {
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

  // Shiny: the outer span carries className+style so the transform and sizing
  // class apply to the wrapper. The inner video must NOT reuse className so it
  // doesn't fight with the span for sizing.
  //
  // shinyFill=true  → className gives an explicit size (e.g. width:100%).
  //                   Inner video uses width:100%;height:100% to fill the span.
  // shinyFill=false → className uses auto-sizing (e.g. width:auto).
  //                   Inner video uses width:auto so there's no circular %-ref.
  const innerStyle: CSSProperties = shinyFill
    ? { width: '100%', height: '100%', imageRendering: 'auto' }
    : { width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%', imageRendering: 'auto' }

  const innerSprite = useFallback ? (
    <img key={id} ref={imgRef} src={fallback} alt="" draggable={false} style={innerStyle} />
  ) : (
    <video
      key={id} ref={videoRef} autoPlay loop muted playsInline
      disablePictureInPicture draggable={false}
      style={innerStyle} onError={() => setUseFallback(true)}
    >
      <source src={webm} type="video/webm" onError={() => setUseFallback(true)} />
    </video>
  )

  return (
    <span className={`${styles.wrap}${className ? ` ${className}` : ''}`} style={baseStyle}>
      {innerSprite}
      <span className={styles.shinyBadge}>★</span>
    </span>
  )
}
