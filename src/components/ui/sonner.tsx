import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group font-sans"
      toastOptions={{
        classNames: {
          toast:
            "group toast font-sans group-[.toaster]:bg-blue-600 group-[.toaster]:text-white group-[.toaster]:border-blue-700 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-white/90",
          actionButton: "group-[.toast]:bg-white group-[.toast]:text-blue-600 group-[.toast]:hover:bg-white/90",
          cancelButton: "group-[.toast]:bg-white/20 group-[.toast]:text-white group-[.toast]:hover:bg-white/30",
          error: 'group-[.toaster]:bg-red-600 group-[.toaster]:text-white group-[.toaster]:border-red-700',
          success: 'group-[.toaster]:bg-blue-600 group-[.toaster]:text-white group-[.toaster]:border-blue-700',
          warning: 'group-[.toaster]:bg-amber-600 group-[.toaster]:text-white group-[.toaster]:border-amber-700',
          info: 'group-[.toaster]:bg-blue-600 group-[.toaster]:text-white group-[.toaster]:border-blue-700',
        },
        style: {
          background: 'rgb(37, 99, 235)',
          border: '1px solid rgb(29, 78, 216)',
          color: 'white',
          opacity: '1',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
