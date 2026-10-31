
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";

import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <main
      className="min-h-screen bg-background px-4 py-8 md:px-8"
      aria-label="Memuat dashboard"
      aria-busy="true"
    >
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Dashboard heading */}
        <div className="space-y-3">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>

        {/* Statistics cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-5 rounded-md" />
              </CardHeader>

              <CardContent>
                <Skeleton className="h-9 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Inventory table skeleton */}
        <Card>
          <CardHeader className="space-y-3">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="h-4 w-full"
                  />
                ))}
              </div>

              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-5 gap-4"
                >
                  {Array.from({ length: 5 }).map(
                    (_, cellIndex) => (
                      <Skeleton
                        key={cellIndex}
                        className="h-5 w-full"
                      />
                    )
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Analytics skeleton */}
        <section className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>

            <Skeleton className="h-10 w-40 rounded-lg" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
