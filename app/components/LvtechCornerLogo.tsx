import Image from 'next/image'
import Link from 'next/link'

type LvtechCornerLogoProps = {
  href?: string
  className?: string
}

/** LV tech-logotyp i vänstra hörnet (samma som inloggad navigation). */
export default function LvtechCornerLogo({ href, className = '' }: LvtechCornerLogoProps) {
  const image = (
    <Image
      src="/lvtech-logo.png"
      alt="LV tech"
      width={120}
      height={120}
      className="h-10 w-auto sm:h-12"
      priority
    />
  )

  return (
    <div className={`absolute top-4 left-4 sm:top-6 sm:left-6 z-10 ${className}`}>
      {href ? (
        <Link href={href} className="inline-flex items-center" aria-label="Till startsidan">
          {image}
        </Link>
      ) : (
        <span className="inline-flex items-center">{image}</span>
      )}
    </div>
  )
}
