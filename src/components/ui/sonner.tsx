import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-oled-elevated/90 group-[.toaster]:backdrop-blur-md group-[.toaster]:text-foreground group-[.toaster]:border-gray-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-neon-purple group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-oled-surface group-[.toast]:text-muted-foreground",
          success: "group-[.toast]:border-neon-blue/40 group-[.toast]:shadow-neon-blue",
          error: "group-[.toast]:border-destructive/40",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
