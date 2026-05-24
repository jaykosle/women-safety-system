// app/dashboard/map/page.tsx
import SafeRouteMap from '@/components/SafeRouteMap'

export default function MapPage() {
  // 73px = sticky dashboard header height
  return (
    <div style={{ height: 'calc(100vh - 73px)' }} className="w-full">
      <SafeRouteMap />
    </div>
  )
}
