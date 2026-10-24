import { cn } from "@/lib/utils"

/**
 * Wrapper for table action buttons that stacks them vertically on mobile
 * and displays them inline on desktop. This improves mobile tap targets
 * by giving each button full width on small screens.
 *
 * Usage:
 * ```tsx
 * <TableCell>
 *   <TableRowActions>
 *     <Button variant="outline" size="sm">変更</Button>
 *     <ConfirmActionDialog ... />
 *   </TableRowActions>
 * </TableCell>
 * ```
 */
export function TableRowActions({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2 md:flex-row md:justify-end", className)}>
      {children}
    </div>
  )
}
