import { useQuery } from '@tanstack/react-query'
import { serviceImageUrl, supabase } from '../../lib/supabase'

export interface ServiceImage {
  id: string
  url: string
  alt: string
}

export interface Service {
  id: string
  name: string
  tagline: string | null
  description: string | null
  organizationId: string
  organizationName: string
  images: ServiceImage[]
}

// Signed-out visitors read every service; members read only their organization's (RLS).
const SERVICE_COLUMNS =
  'id, name, tagline, description, organization_id, organizations(name), service_images(id, path, alt_text, sort_order)'

type ServiceRow = {
  id: string
  name: string
  tagline: string | null
  description: string | null
  organization_id: string
  organizations: { name: string } | null
  service_images: { id: string; path: string; alt_text: string | null; sort_order: number }[]
}

function toService(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    organizationId: row.organization_id,
    organizationName: row.organizations?.name ?? '',
    images: [...row.service_images]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((image) => ({
        id: image.id,
        url: serviceImageUrl(image.path),
        alt: image.alt_text ?? '',
      })),
  }
}

/** One service, or `null` when it does not exist or the viewer may not read it. */
export function useService(serviceId: string) {
  return useQuery({
    queryKey: ['service', serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select(SERVICE_COLUMNS)
        .eq('id', serviceId)
        .maybeSingle()
      if (error) throw error
      return data ? toService(data) : null
    },
  })
}

/** Every service the viewer may read, by name. */
export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select(SERVICE_COLUMNS)
        .order('name')
      if (error) throw error
      return data.map(toService)
    },
  })
}

/** Ids are UUIDs; anything else cannot be a service. */
export function isUuid(value: string | undefined): value is string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value ?? '')
}
