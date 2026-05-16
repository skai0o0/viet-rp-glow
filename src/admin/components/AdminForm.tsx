import { forwardRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/* ── AdminForm — responsive grid container ── */

interface AdminFormProps {
  columns?: 1 | 2;
  gap?: "sm" | "md";
  children: ReactNode;
  className?: string;
}

const AdminForm = forwardRef<HTMLDivElement, AdminFormProps>(
  ({ columns = 1, gap = "md", children, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "grid grid-cols-1",
          columns === 2 && "sm:grid-cols-2",
          gap === "sm" ? "gap-2" : "gap-3",
          className,
        )}
      >
        {children}
      </div>
    );
  },
);
AdminForm.displayName = "AdminForm";

/* ── AdminFormField — label + description + child ── */

interface AdminFormFieldProps {
  label: string;
  description?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

const AdminFormField = forwardRef<HTMLDivElement, AdminFormFieldProps>(
  ({ label, description, required, children, className }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-1.5", className)}>
        <Label className="text-xs text-muted-foreground">
          {label}
          {required && <span className="text-neon-rose ml-0.5">*</span>}
        </Label>
        {children}
        {description && (
          <p className="text-[10px] text-muted-foreground/60">{description}</p>
        )}
      </div>
    );
  },
);
AdminFormField.displayName = "AdminFormField";

/* ── AdminFormFullWidth — spans full width in 2-col grid ── */

interface AdminFormFullWidthProps {
  children: ReactNode;
  className?: string;
}

const AdminFormFullWidth = forwardRef<HTMLDivElement, AdminFormFullWidthProps>(
  ({ children, className }, ref) => {
    return (
      <div ref={ref} className={cn("sm:col-span-2", className)}>
        {children}
      </div>
    );
  },
);
AdminFormFullWidth.displayName = "AdminFormFullWidth";

export { AdminForm, AdminFormField, AdminFormFullWidth };
export type { AdminFormProps, AdminFormFieldProps, AdminFormFullWidthProps };
