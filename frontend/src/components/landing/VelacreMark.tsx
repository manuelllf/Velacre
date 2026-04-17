import Image from 'next/image'

function pick(size: number) {
  if (size <= 64) return '/icons/logo-64.png'
  if (size <= 128) return '/icons/logo-128.png'
  if (size <= 256) return '/icons/logo-256.png'
  return '/icons/logo-1024.png'
}

export function VelacreMark({ size = 36, className }: { size?: number; className?: string }) {
  const src = pick(size)
  return (
    <Image
      src={src}
      alt="Velacre"
      width={size}
      height={size}
      priority
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  )
}
