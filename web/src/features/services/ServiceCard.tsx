import { Link } from 'react-router'
import type { Service } from './api'

/**
 * A service as a tall photo card. `compact` shows only the name, for small
 * cards where the organization is already known (a member's own services).
 */
export function ServiceCard({
  service,
  compact = false,
  className = '',
}: {
  service: Service
  compact?: boolean
  className?: string
}) {
  const image = service.images[0]
  return (
    <Link
      to={`/services/${service.id}`}
      className={`group relative block overflow-hidden rounded-2xl bg-ink ${compact ? 'aspect-square' : 'aspect-[4/5]'} ${className}`}
    >
      {image && (
        <img
          src={image.url}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/35 to-transparent" />
      <span className="absolute inset-x-0 bottom-0 p-4 text-white">
        {!compact && <span className="block text-sm font-semibold text-white/80">{service.organizationName}</span>}
        <span className="block font-display text-3xl leading-none font-bold">{service.name}</span>
        {!compact && service.tagline && (
          <span className="mt-2 line-clamp-2 block text-sm text-white/85">{service.tagline}</span>
        )}
      </span>
    </Link>
  )
}
