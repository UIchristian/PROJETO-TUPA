import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/mapa')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/mapa"!</div>
}
