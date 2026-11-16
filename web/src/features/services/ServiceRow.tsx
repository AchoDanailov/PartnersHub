import { ServiceCard } from './ServiceCard'
import { useServices } from './api'

/** Other services to discover, as a swipeable row. Shown to signed-out visitors only. */
export function ServiceRow({ excludeId }: { excludeId: string }) {
  const services = useServices()
  const others = (services.data ?? []).filter((service) => service.id !== excludeId)
  if (others.length === 0) return null

  return (
    <div className="snap-row -mx-4 flex scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6">
      {others.map((service) => (
        <ServiceCard key={service.id} service={service} className="w-[68%] shrink-0 sm:w-64" />
      ))}
    </div>
  )
}
