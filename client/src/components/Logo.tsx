/**
 * The Bermi "b + sparkle" mark. `BermiMark` renders in currentColor so it
 * adapts to context; `BermiTile` is the app-icon treatment (brand blue tile,
 * white mark) used for avatars and the favicon.
 */
export function BermiMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <mask id="bermi-mark-mask">
          <rect width="512" height="512" fill="black" />
          <rect x="143" y="61" width="72" height="256" rx="36" fill="white" />
          <circle cx="286" cy="307" r="143" fill="white" />
          <circle cx="286" cy="307" r="72" fill="black" />
          <path
            fill="black"
            d="M215 240 C222.5 285 237 299.5 282 307 C237 314.5 222.5 329 215 374 C207.5 329 193 314.5 148 307 C193 299.5 207.5 285 215 240 Z"
          />
        </mask>
      </defs>
      <rect width="512" height="512" fill="currentColor" mask="url(#bermi-mark-mask)" />
    </svg>
  )
}

export function BermiTile({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <mask id="bermi-tile-mask">
          <rect width="512" height="512" fill="black" />
          <rect x="143" y="61" width="72" height="256" rx="36" fill="white" />
          <circle cx="286" cy="307" r="143" fill="white" />
          <circle cx="286" cy="307" r="72" fill="black" />
          <path
            fill="black"
            d="M215 240 C222.5 285 237 299.5 282 307 C237 314.5 222.5 329 215 374 C207.5 329 193 314.5 148 307 C193 299.5 207.5 285 215 240 Z"
          />
        </mask>
      </defs>
      <rect width="512" height="512" rx="118" fill="#1B3FD6" />
      <rect width="512" height="512" fill="#ffffff" mask="url(#bermi-tile-mask)" />
    </svg>
  )
}
