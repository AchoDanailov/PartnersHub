import { Navigate } from 'react-router'
import { AppHeader } from '../components/AppHeader'
import { PageLoading, PageMessage } from '../components/PageState'
import { useViewer, type Member } from '../features/auth/useViewer'
import { useDashboard, type DashboardData } from '../features/dashboard/api'
import { useServices, type Service } from '../features/services/api'
import { formatDate, formatDateTime } from '../lib/format'

const today = () => new Date().toISOString().slice(0, 10)

/** The admin's overview of their organization's vouchers and client questions. */
export function DashboardPage() {
  const viewer = useViewer()
  if (viewer.status === 'loading') return <PageLoading />
  if (viewer.status !== 'member' || viewer.member.role !== 'admin') return <Navigate to="/" replace />
  return <Dashboard member={viewer.member} />
}

function Dashboard({ member }: { member: Member }) {
  const dashboard = useDashboard()
  const services = useServices()

  if (dashboard.isPending || services.isPending) return <PageLoading />
  if (dashboard.isError || services.isError) {
    return (
      <>
        <AppHeader />
        <PageMessage title="Таблото не се зареди">
          <p>Проверете интернет връзката и презаредете страницата.</p>
        </PageMessage>
      </>
    )
  }

  const data = dashboard.data
  const names = new Map(services.data.map((service) => [service.id, service.name]))
  const counts = countByState(data)
  const unused = data.vouchers
    .filter((voucher) => voucher.status === 'active' && voucher.expiresOn >= today())
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6">
        <p className="font-semibold text-ink-soft">{member.organizationName}</p>
        <h1 className="font-display text-6xl leading-none font-extrabold">Табло</h1>

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Валидни" value={counts.total.valid} tone="text-valid" />
          <Stat label="Използвани" value={counts.total.used} tone="text-ink" />
          <Stat label="Изтекли" value={counts.total.expired} tone="text-warn" />
          <Stat label="Анулирани" value={counts.total.cancelled} tone="text-danger" />
        </dl>

        <div className="mt-12 grid gap-12 lg:grid-cols-2">
          <Section title="По услуги">
            <ul className="divide-y divide-line rounded-2xl bg-white">
              {services.data.map((service) => {
                const row = counts.byService.get(service.id) ?? emptyCounts()
                return (
                  <li key={service.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
                    <span className="font-bold">{service.name}</span>
                    <span className="text-sm text-ink-soft">
                      {row.valid} валидни, {row.used} използвани, {row.expired} изтекли
                    </span>
                  </li>
                )
              })}
            </ul>
          </Section>

          <Section title="Въпроси от клиенти">
            <Questions services={services.data} data={data} />
          </Section>

          <Section title="Използвани ваучери">
            {data.redemptions.length === 0 ? (
              <Empty>Още няма използвани ваучери.</Empty>
            ) : (
              <ul className="divide-y divide-line rounded-2xl bg-white">
                {data.redemptions.map((redemption) => (
                  <li key={redemption.id} className="grid gap-1 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-baseline">
                    <span>
                      <span className="font-bold">{names.get(redemption.serviceId)}</span>
                      <span className="ml-2 font-display text-lg tracking-wider text-ink-soft">{redemption.code}</span>
                    </span>
                    <span className="text-sm text-ink-soft">
                      {formatDateTime(redemption.redeemedAt)}, {data.usernames.get(redemption.redeemedBy) ?? 'бивш служител'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Валидни, още неизползвани">
            {unused.length === 0 ? (
              <Empty>Няма валидни неизползвани ваучери.</Empty>
            ) : (
              <ul className="divide-y divide-line rounded-2xl bg-white">
                {unused.map((voucher) => (
                  <li key={voucher.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
                    <span className="font-bold">{names.get(voucher.serviceId)}</span>
                    <span className="text-sm text-ink-soft">валиден до {formatDate(voucher.expiresOn)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </main>
    </>
  )
}

type Counts = { valid: number; used: number; expired: number; cancelled: number }

function emptyCounts(): Counts {
  return { valid: 0, used: 0, expired: 0, cancelled: 0 }
}

function countByState(data: DashboardData) {
  const total = emptyCounts()
  const byService = new Map<string, Counts>()
  const now = today()
  for (const voucher of data.vouchers) {
    const state: keyof Counts =
      voucher.status === 'redeemed'
        ? 'used'
        : voucher.status === 'cancelled'
          ? 'cancelled'
          : voucher.expiresOn < now
            ? 'expired'
            : 'valid'
    total[state] += 1
    const row = byService.get(voucher.serviceId) ?? emptyCounts()
    row[state] += 1
    byService.set(voucher.serviceId, row)
  }
  return { total, byService }
}

function Questions({ services, data }: { services: Service[]; data: DashboardData }) {
  const groups = services
    .map((service) => ({ service, questions: data.questions.filter((q) => q.serviceId === service.id) }))
    .filter((group) => group.questions.length > 0)
  if (groups.length === 0) return <Empty>Още няма въпроси от клиенти.</Empty>
  return (
    <div className="flex flex-col gap-3">
      {groups.map(({ service, questions }) => (
        <div key={service.id} className="rounded-2xl bg-white px-5 py-4">
          <p className="font-bold">{service.name}</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-ink-soft">
            {questions.map((question) => (
              <li key={question.id}>{question.question}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl bg-white px-5 py-4">
      <dt className="text-sm font-semibold text-ink-soft">{label}</dt>
      <dd className={`font-display text-5xl leading-none font-extrabold ${tone}`}>{value}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 font-display text-3xl leading-none font-bold">{title}</h2>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-white px-5 py-4 text-ink-soft">{children}</p>
}
