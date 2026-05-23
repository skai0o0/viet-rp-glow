import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const AppFooter = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => {
    const year = new Date().getFullYear();

    return (
      <footer
        ref={ref}
        className={cn("w-full border-t border-border bg-card/50 mt-auto py-4 px-4", className)}
        {...props}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>&copy; {year} VietRP. Mọi quyền được bảo lưu.</span>
          <Link
            to="/terms"
            className="hover:text-foreground transition-colors underline underline-offset-2"
          >
            Điều khoản &amp; Miễn trừ trách nhiệm
          </Link>
        </div>
      </footer>
    );
  }
);

AppFooter.displayName = "AppFooter";

export default AppFooter;
