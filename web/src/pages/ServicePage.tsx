import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { AppHeader } from '../components/AppHeader'
import { PageLoading, PageMessage } from '../components/PageState'
import { Sheet } from '../components/Sheet'
import { useViewer } from '../features/auth/useViewer'
import { BuyVoucherLink } from '../features/redeem/BuyVoucherLink'
import { RedeemPanel } from '../features/redeem/RedeemPanel'
import { useVoucherStatus } from '../features/redeem/useVoucherStatus'
import { VoucherBar } from '../features/redeem/VoucherBar'
import { isUuid, useService, type Service } from '../features/services/api'
import { ServiceRow } from '../features/services/ServiceRow'
import { paragraphs } from '../lib/format'
import { NotFoundPage } from './NotFoundPage'

/**
 * A service's page, opened from a voucher's QR code (`?t=<qr_token>`) or by
 * link. Clients see the service and their voucher; members also use vouchers
 * here. A member sees only their own organization's services: any other
 * service page sends them home.
 */
export function ServicePage() {
  const { serviceId } = useParams()
  if (!isUuid(serviceId)) return <NotFoundPage />
  return <ServicePageContent key={serviceId} serviceId={serviceId.toLowerCase()} />
}

function ServicePageContent({ serviceId }: { serviceId: string }) {
  const [params] = useSearchParams()
  const rawToken = params.get('t')
  const qrToken = isUuid(rawToken ?? undefined) ? rawToken!.toLowerCase() : null

  const viewer = useViewer()
  const service = useService(serviceId)
  const voucher = useVoucherStatus(qrToken)
  const [sheetOpen, setSheetOpen] = useState(qrToken !== null)

  if (viewer.status === 'loading' || service.isPending) return <PageLoading />
  if (service.isError) {
    return (
      <PageMessage title="Страницата не се зареди">
        <p>Проверете интернет връзката и презаредете страницата.</p>
      </PageMessage>
    )
  }
  if (!service.data) {
    return viewer.status === 'anonymous' ? <NotFoundPage /> : <Navigate to="/" replace />
  }
  // A QR token of another service's voucher: show it on that service's page.
  if (voucher.data && voucher.data.serviceId !== serviceId) {
    return <Navigate to={`/services/${voucher.data.serviceId}?t=${qrToken}`} replace />
  }

  const anonymous = viewer.status === 'anonymous'

  return (
    <div className="min-h-svh pb-32">
      <AppHeader overlay />
      <Hero service={service.data} />

      <main className="mx-auto max-w-3xl px-4 sm:px-6">
        <Story service={service.data} />
        <Gallery service={service.data} />

        {anonymous && (
          <section className="mt-14 rounded-[1.75rem] bg-ticket px-6 py-8 sm:px-10">
            <h2 className="font-display text-4xl leading-none font-bold">Подарете {service.data.name.toLowerCase()}</h2>
            <p className="mt-3 max-w-md">
              Ваучерите за {service.data.organizationName} се купуват от нашия сайт и пристигат веднага.
            </p>
            <BuyVoucherLink variant="ink" className="mt-6" />
          </section>
        )}

        {anonymous && (
          <section className="mt-14">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-4xl leading-none font-bold">Още преживявания</h2>
              <Link
                to="/services"
                className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-indigo"
              >
                Всички
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
            <div className="mt-5">
              <ServiceRow excludeId={service.data.id} />
            </div>
          </section>
        )}
      </main>

      <footer className="mx-auto mt-16 flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 text-sm text-ink-soft sm:px-6">
        <span>Partners Hub</span>
        {anonymous && (
          <Link to="/" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            Вход за партньори
          </Link>
        )}
      </footer>

      <VoucherBar qrToken={qrToken} viewer={viewer} onOpen={() => setSheetOpen(true)} />
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={qrToken && anonymous ? 'Вашият ваучер' : 'Използване на ваучер'}
      >
        <RedeemPanel qrToken={qrToken} />
      </Sheet>
    </div>
  )
}

function Hero({ service }: { service: Service }) {
  const image = service.images[0]
  return (
    <section className="relative flex min-h-[78svh] items-end overflow-hidden bg-ink text-white sm:min-h-[70svh]">
      {image && (
        <img
          src={image.url}
          alt={image.alt}
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-ink/0" />
      <div className="relative mx-auto w-full max-w-3xl px-4 pt-28 pb-10 sm:px-6 sm:pb-14">
        <p className="text-base font-semibold text-white/85">{service.organizationName}</p>
        <h1 className="mt-1 font-display text-[clamp(4rem,19vw,8.5rem)] leading-[0.85] font-extrabold tracking-tight break-words">
          {service.name}
        </h1>
        {service.tagline && <p className="mt-4 max-w-lg text-lg text-white/90 sm:text-xl">{service.tagline}</p>}
      </div>
    </section>
  )
}

function Story({ service }: { service: Service }) {
  const text = paragraphs(service.description)
  if (text.length === 0) return null
  return (
    <section className="mt-10 flex max-w-[62ch] flex-col gap-4 text-lg leading-relaxed">
      {text.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </section>
  )
}

function Gallery({ service }: { service: Service }) {
  const images = service.images.slice(1)
  if (images.length === 0) return null
  return (
    <section aria-label="Снимки" className="mt-10">
      <div className="snap-row -mx-4 flex scroll-px-4 gap-3 overflow-x-auto px-4 sm:-mx-6 sm:scroll-px-6 sm:px-6">
        {images.map((image) => (
          <img
            key={image.id}
            src={image.url}
            alt={image.alt}
            loading="lazy"
            className="aspect-[4/3] w-[85%] shrink-0 rounded-2xl object-cover sm:w-[70%]"
          />
        ))}
      </div>
    </section>
  )
}
