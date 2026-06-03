import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton-shimmer bg-accent rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
