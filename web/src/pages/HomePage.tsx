import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { AppHeader } from '../components/AppHeader'
import { PageLoading } from '../components/PageState'
import { SignInForm } from '../features/auth/SignInForm'
import { useViewer, type Member } from '../features/auth/useViewer'
import { RedeemPanel } from '../features/redeem/RedeemPanel'
import { useServices } from '../features/services/api'
import { ServiceCard } from '../features/services/ServiceCard'
import { supabase } from '../lib/supabase'

/** Where staff and admins start: sign in, then use vouchers by code. */
export function HomePage() {
  const viewer = useViewer()
  if (viewer.status === 'loading') return <PageLoading />

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 pt-10 pb-16 sm:px-6">
        {viewer.status === 'member' ? (
          <MemberHome member={viewer.member} />
        ) : viewer.status === 'outsider' ? (
          <div className="max-w-md">
            <h1 className="font-display text-5xl leading-none font-extrabold">Няма достъп</h1>
            <p className="mt-3">Профилът ви не е свързан с организация. Свържете се с администратора си.</p>
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="mt-4 min-h-11 cursor-pointer font-semibold text-indigo underline-offset-4 hover:underline"
            >
              Изход
            </button>
          </div>
        ) : (
          <SignedOutHome />
        )}
      </main>
    </>
  )
}

function SignedOutHome() {
  return (
    <div className="grid gap-10 md:grid-cols-[1fr_minmax(0,26rem)] md:items-start">
      <div className="md:pt-6">
        <h1 className="font-display text-6xl leading-[0.9] font-extrabold sm:text-7xl">Вход за партньори</h1>
        <p className="mt-4 max-w-md text-lg text-ink-soft">
          Служителите и администраторите на нашите партньори проверяват и използват ваучерите на клиентите оттук.
        </p>
        <Link
          to="/services"
          className="mt-8 inline-flex min-h-11 items-center gap-2 font-semibold text-indigo underline-offset-4 hover:underline"
        >
          Разгледайте всички преживявания
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
      <div className="rounded-[1.75rem] bg-white p-6 shadow-[0_10px_30px_rgba(20,26,51,0.08)]">
        <SignInForm />
      </div>
    </div>
  )
}

function MemberHome({ member }: { member: Member }) {
  const services = useServices()
  return (
    <div className="grid gap-12 md:grid-cols-[minmax(0,26rem)_1fr]">
      <section>
        <p className="font-semibold text-ink-soft">{member.organizationName}</p>
        <h1 className="font-display text-5xl leading-none font-extrabold">Използване на ваучер</h1>
        <div className="mt-6">
          <RedeemPanel qrToken={null} />
        </div>
      </section>
      <section>
        <h2 className="font-display text-3xl leading-none font-bold">Вашите услуги</h2>
        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {services.data?.map((service) => (
            <ServiceCard key={service.id} service={service} compact />
          ))}
        </div>
      </section>
    </div>
  )
}
