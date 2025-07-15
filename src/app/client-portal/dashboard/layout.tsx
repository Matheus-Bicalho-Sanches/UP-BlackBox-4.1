import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portal do Cliente',
  description: 'Portal do cliente UP Gestão',
}

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 