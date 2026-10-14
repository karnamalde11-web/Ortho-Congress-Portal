"use client";
import { useRouter } from "next/navigation";
export default function BookingRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      className="cursor-pointer border-b border-slate-200 hover:bg-teal-50 focus-visible:bg-teal-50"
      tabIndex={0}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a,button,input,select"))
          return;
        if (event.ctrlKey || event.metaKey)
          window.open(href, "_blank", "noopener");
        else router.push(href);
      }}
      onKeyDown={(event) => {
        if (
          event.target === event.currentTarget &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          router.push(href);
        }
      }}
    >
      {children}
    </tr>
  );
}
