import { AppHeader } from '../components/AppHeader'
import { ButtonLink } from '../components/Button'
import { PageMessage } from '../components/PageState'

export function NotFoundPage() {
  return (
    <>
      <AppHeader />
      <PageMessage title="Няма такава страница">
        <p>Връзката може да е грешна или услугата вече да не се предлага.</p>
        <ButtonLink to="/services" variant="outline" className="self-start">
          Разгледайте преживяванията
        </ButtonLink>
      </PageMessage>
    </>
  )
}
