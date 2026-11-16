import { Navigate } from 'react-router'
import { AppHeader } from '../components/AppHeader'
import { PageLoading, PageMessage } from '../components/PageState'
import { useViewer } from '../features/auth/useViewer'
import { useServices } from '../features/services/api'
import { ServiceCard } from '../features/services/ServiceCard'

/** Every service of every organization, for signed-out visitors. Members go home. */
export function ServicesPage() {
  const viewer = useViewer()
  const services = useServices()

  if (viewer.status === 'member' || viewer.status === 'outsider') return <Navigate to="/" replace />
  if (viewer.status === 'loading' || services.isPending) return <PageLoading />
  if (services.isError) {
    return (
      <PageMessage title="Страницата не се зареди">
        <p>Проверете интернет връзката и презаредете страницата.</p>
      </PageMessage>
    )
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6">
        <h1 className="font-display text-6xl leading-none font-extrabold">Преживявания</h1>
        <p className="mt-3 max-w-md text-lg text-ink-soft">Изберете какво да подарите или да изживеете сами.</p>
        <div className="mt-8 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
          {services.data.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      </main>
    </>
  )
}
